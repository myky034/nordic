BEGIN;
-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "access_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_id" UUID,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "access_audit_created_at_idx" ON "access_audit"("created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_auth_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.roles ADD CONSTRAINT roles_text_check CHECK (length(trim(name)) BETWEEN 1 AND 80 AND length(description) <= 300);
INSERT INTO public.permissions (key, description) VALUES
('documents.read', 'Read document metadata (also available publicly).'),
('documents.ingest', 'Import source-linked documents.'),
('users.assign_roles', 'Search users and assign or remove roles.'),
('roles.manage', 'Create roles and configure their permissions.');
INSERT INTO public.roles (name, description) VALUES
('Administrator', 'Manage access and import documents.'),
('Editor', 'Import documents without managing access.'),
('Member', 'Read public research content.');
INSERT INTO public.role_permissions (role_id, permission_key)
 SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'Administrator';
INSERT INTO public.role_permissions (role_id, permission_key)
 SELECT id, 'documents.ingest' FROM public.roles WHERE name = 'Editor';
INSERT INTO public.role_permissions (role_id, permission_key)
 SELECT id, 'documents.read' FROM public.roles WHERE name IN ('Editor', 'Member');

-- Identity comes from Supabase's verified JWT, never a caller-supplied actor ID.
-- SECURITY DEFINER avoids recursive policies. Fixed search_path prevents shadowing.
CREATE FUNCTION public.has_permission(p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id = ur.role_id
 JOIN auth.users u ON u.id=ur.user_id WHERE ur.user_id = auth.uid() AND rp.permission_key = p_key AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now()));
$$;
CREATE FUNCTION public.rbac_admin_count() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT count(*) FROM (SELECT ur.user_id FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id = ur.role_id
 JOIN auth.users u ON u.id=ur.user_id WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now()) AND rp.permission_key IN ('roles.manage', 'users.assign_roles') GROUP BY ur.user_id HAVING count(DISTINCT rp.permission_key) = 2) admins;
$$;
CREATE FUNCTION public.my_permissions() RETURNS TABLE(key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT DISTINCT rp.permission_key FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id = ur.role_id JOIN auth.users u ON u.id=ur.user_id WHERE ur.user_id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now());
$$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roles, public.permissions, public.role_permissions, public.user_roles, public.access_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions, public.user_roles, public.access_audit TO authenticated;
CREATE POLICY roles_catalog ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_catalog ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_catalog ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_permission('users.assign_roles'));
CREATE POLICY audit_managers_read ON public.access_audit FOR SELECT TO authenticated USING (public.has_permission('roles.manage') OR public.has_permission('users.assign_roles'));

CREATE FUNCTION public.save_access_role(p_id uuid, p_name text, p_description text, p_permissions text[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_before jsonb;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(918202603);
 IF NOT public.has_permission('roles.manage') THEN RAISE EXCEPTION 'rbac_forbidden'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 80 OR p_description IS NULL OR length(p_description) > 300 OR p_permissions IS NULL OR cardinality(p_permissions) > 50 THEN RAISE EXCEPTION 'rbac_invalid'; END IF;
 -- Cannot grant rights the actor does not already hold, even by editing a shared role.
 IF EXISTS (SELECT 1 FROM unnest(p_permissions) k WHERE k IS NULL OR NOT public.has_permission(k)) THEN RAISE EXCEPTION 'rbac_cannot_delegate'; END IF;
 IF p_id IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id=p_id) THEN RAISE EXCEPTION 'rbac_not_found'; END IF;
   IF EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id=p_id AND NOT public.has_permission(permission_key)) THEN RAISE EXCEPTION 'rbac_cannot_delegate'; END IF;
   SELECT jsonb_build_object('name',r.name,'description',r.description,'permissions',(SELECT coalesce(jsonb_agg(permission_key ORDER BY permission_key),'[]') FROM public.role_permissions WHERE role_id=p_id)) INTO v_before FROM public.roles r WHERE r.id=p_id;
   UPDATE public.roles SET name=trim(p_name), description=p_description WHERE id=p_id RETURNING id INTO v_id;
 ELSE
   INSERT INTO public.roles(name, description) VALUES(trim(p_name), p_description) RETURNING id INTO v_id;
 END IF;
 DELETE FROM public.role_permissions WHERE role_id=v_id;
 INSERT INTO public.role_permissions(role_id, permission_key) SELECT v_id, k FROM (SELECT DISTINCT unnest(p_permissions) AS k) entries;
 IF public.rbac_admin_count() = 0 THEN RAISE EXCEPTION 'rbac_last_admin'; END IF;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'role.saved',v_id,jsonb_build_object('before',v_before,'after',jsonb_build_object('name',trim(p_name),'description',p_description,'permissions',p_permissions)));
 RETURN v_id;
END $$;

CREATE FUNCTION public.assign_access_role(p_user uuid, p_role uuid, p_grant boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(918202603);
 IF NOT public.has_permission('users.assign_roles') THEN RAISE EXCEPTION 'rbac_forbidden'; END IF;
 IF p_user = auth.uid() THEN RAISE EXCEPTION 'rbac_self_assignment'; END IF;
 IF p_grant IS NULL OR p_user IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'rbac_invalid'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user) OR NOT EXISTS (SELECT 1 FROM public.roles WHERE id=p_role) THEN RAISE EXCEPTION 'rbac_not_found'; END IF;
 IF EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id=p_role AND NOT public.has_permission(permission_key)) THEN RAISE EXCEPTION 'rbac_cannot_delegate'; END IF;
 IF p_grant THEN
   INSERT INTO public.user_roles(user_id,role_id) VALUES(p_user,p_role) ON CONFLICT DO NOTHING;
 ELSE
   DELETE FROM public.user_roles WHERE user_id=p_user AND role_id=p_role;
 END IF;
 IF public.rbac_admin_count() = 0 THEN RAISE EXCEPTION 'rbac_last_admin'; END IF;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),CASE WHEN p_grant THEN 'role.granted' ELSE 'role.revoked' END,p_user,jsonb_build_object('role_id',p_role));
END $$;

-- Explicit directory projection: never expose auth.users tokens/password columns.
CREATE FUNCTION public.search_access_users(p_query text, p_offset integer DEFAULT 0)
RETURNS TABLE(user_id uuid, email text, role_ids uuid[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.has_permission('users.assign_roles') THEN RAISE EXCEPTION 'rbac_forbidden'; END IF;
 IF p_query IS NULL OR length(p_query)>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'rbac_invalid'; END IF;
 RETURN QUERY SELECT u.id, u.email::text, ARRAY(SELECT ur.role_id FROM public.user_roles ur WHERE ur.user_id=u.id ORDER BY ur.role_id)
 FROM auth.users u WHERE strpos(lower(coalesce(u.email,'')), lower(p_query)) > 0
 ORDER BY u.created_at, u.id LIMIT 20 OFFSET p_offset;
END $$;

-- Owner-only bootstrap, never an HTTP "claim admin" endpoint.
CREATE FUNCTION public.bootstrap_administrator(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role uuid;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(918202603);
 IF public.rbac_admin_count() > 0 OR EXISTS(SELECT 1 FROM public.access_audit WHERE action='bootstrap') THEN RAISE EXCEPTION 'rbac_already_bootstrapped'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until < now())) THEN RAISE EXCEPTION 'rbac_user_not_eligible'; END IF;
 SELECT id INTO v_role FROM public.roles WHERE name='Administrator';
 IF v_role IS NULL THEN RAISE EXCEPTION 'rbac_not_found'; END IF;
 INSERT INTO public.user_roles(user_id,role_id) VALUES(p_user,v_role);
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(NULL,'bootstrap',p_user,jsonb_build_object('role_id',v_role,'method','database_operator'));
END $$;

REVOKE ALL ON FUNCTION public.has_permission(text), public.my_permissions(), public.rbac_admin_count(), public.save_access_role(uuid,text,text,text[]), public.assign_access_role(uuid,uuid,boolean), public.search_access_users(text,integer), public.bootstrap_administrator(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(text), public.my_permissions(), public.save_access_role(uuid,text,text,text[]), public.assign_access_role(uuid,uuid,boolean), public.search_access_users(text,integer) TO authenticated;
-- No direct writes for authenticated users, even managers: guarded RPCs are the
-- only write path, and every write is audited in the same transaction.
NOTIFY pgrst, 'reload schema';

COMMIT;

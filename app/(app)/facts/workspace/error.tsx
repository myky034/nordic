"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Không tải được thông tin</h1><p>Hãy kiểm tra kết nối và thử lại.</p><button onClick={reset}>Thử lại</button></section>;}

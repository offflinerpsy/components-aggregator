$ErrorActionPreference="Stop"

$root = (Get-Location).Path
$fp   = Join-Path $root 'loads\product_cart\product_cart\deep-search-results.html'
if (!(Test-Path $fp)) { throw "Not found: $fp" }

# 1) читаем и форсим meta charset в самом начале <head>
$bytes = [IO.File]::ReadAllBytes($fp)
$code  = [Text.Encoding]::UTF8.GetString($bytes)
if ($code -notmatch '[\u0400-\u04FF]') { $code = [Text.Encoding]::Default.GetString($bytes) }

$code = [regex]::Replace($code,'(?is)<meta\s+http-equiv=["'']Content-Type["''][^>]*>','')
$code = [regex]::Replace($code,'(?is)<meta\s+charset=["''][^"''>]+["''][^>]*>','')
$code = [regex]::Replace($code,'(?is)(<head[^>]*>)\s*','$1<meta charset="utf-8">',1)

# 2) helper для моков: file:// -> относительный путь, http -> абсолютный
$helper = @"
<script>
  function makeMockUrl(q){
    try{ if(location.protocol==='file:'){
      return '../../public/mock/search-'+encodeURIComponent(q)+'.json';
    }}catch(e){}
    return '/public/mock/search-'+encodeURIComponent(q)+'.json';
  }
</script>
"@
if ($code -notmatch 'function\s+makeMockUrl') {
  $code = [regex]::Replace($code,'(?is)(<script[^>]*>)',"$1$helper",1)
}
$code = [regex]::Replace($code,'(?m)^\s*const\s+mockUrl\s*=.*$','const mockUrl = makeMockUrl(q);')

# 3) сохраняем как UTF-8 с BOM (надёжно для file://)
$enc = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($fp,$code,$enc)

# 4) коммит/пуш (если есть изменения)
git add -- 'loads/product_cart/product_cart/deep-search-results.html' | Out-Null
git commit -m 'fix(front): force UTF-8 meta + universal mock url' --allow-empty | Out-Null
git push | Out-Null

# 5) минимальный dev-сервер с charset=utf-8 в заголовках
$py = Join-Path $root 'devserver.py'
@"
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        p=self.path
        if p.endswith('.html'): self.send_header('Content-Type','text/html; charset=utf-8')
        if p.endswith('.js'):   self.send_header('Content-Type','application/javascript; charset=utf-8')
        if p.endswith('.css'):  self.send_header('Content-Type','text/css; charset=utf-8')
        super().end_headers()
os.chdir(r'$root')
ThreadingHTTPServer(('127.0.0.1',5173), H).serve_forever()
"@ | Set-Content -Encoding UTF8 $py

Start-Process -WindowStyle Minimized py -ArgumentList @($py)
Start-Sleep -s 1

# 6) открываем страницу
$q=[Uri]::EscapeDataString('транзистор')
Start-Process "http://127.0.0.1:5173/loads/product_cart/product_cart/deep-search-results.html?q=$q"

'DONE'

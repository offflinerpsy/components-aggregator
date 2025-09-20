from pathlib import Path

p = Path("tools/warden/app.py")
src = p.read_text(encoding="utf-8", errors="strict")

# 1) помечаем форму git-пуш как id='gitPushForm'
src2 = src.replace("form method='post' action='/git/push'", "form id='gitPushForm' method='post' action='/git/push'")

# 2) добавляем JS-тост и AJAX отправку (в конец HTML перед return)
inject = r"""
<script>
(function(){
  function toast(msg, ok){
    var t = document.getElementById('wl_toast');
    if(!t){
      t = document.createElement('div');
      t.id='wl_toast';
      t.style.cssText='position:fixed;right:16px;bottom:16px;padding:10px 14px;background:#222;color:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.3);z-index:9999;font-family:system-ui,Arial,sans-serif;transition:opacity .25s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = ok ? '#1f6f2e' : '#7a1f1f';
    t.style.opacity = 1;
    setTimeout(function(){ t.style.opacity = 0; }, 2000);
  }

  var f = document.getElementById('gitPushForm') || document.querySelector("form[action='/git/push']");
  if(!f) return;
  f.id = 'gitPushForm';

  f.addEventListener('submit', function(e){
    e.preventDefault();
    var btn = f.querySelector("button[type='submit']");
    if(btn){ btn.disabled = true; btn.textContent = 'Pushing…'; }
    var fd = new FormData(f);

    fetch('/git/push', { method:'POST', body:fd, headers:{'X-Requested-With':'fetch'} })
      .then(r => r.text().then(txt => ({ ok:r.ok, txt })))
      .then(o => {
        if(btn){ btn.disabled = false; btn.textContent = 'git add/commit/push'; }
        var pre = document.getElementById('pushOutput');
        if(!pre){
          pre = document.createElement('pre');
          pre.id = 'pushOutput';
          pre.style.whiteSpace='pre-wrap';
          pre.style.background='#111';
          pre.style.color='#ddd';
          pre.style.padding='8px';
          pre.style.borderRadius='8px';
          pre.style.marginTop='8px';
          f.parentNode.appendChild(pre);
        }
        pre.textContent = o.txt;
        toast(o.ok ? 'Git push: OK' : 'Git push: FAIL', o.ok);
      })
      .catch(() => {
        if(btn){ btn.disabled = false; btn.textContent = 'git add/commit/push'; }
        toast('Git push: ERROR', false);
      });
  });
})();
</script>
"""

needle = "return html_page"
if needle in src2 and inject not in src2:
    src2 = src2.replace(needle, "html_page += '''%s'''\n    %s" % (inject.strip(), needle))

p.write_text(src2, encoding="utf-8")
print("Patched: tools/warden/app.py")

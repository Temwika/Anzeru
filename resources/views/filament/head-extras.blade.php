{{-- PWA --}}
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0a1628">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">

{{-- Dark mode: runs before first paint to avoid flash --}}
<script>
(function(){
  var d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');
  function pref(){try{return localStorage.getItem('theme')||'system'}catch(e){return 'system'}}
  function apply(){var p=pref();d.classList.toggle('dark',p==='dark'||(p!=='light'&&m.matches));}
  apply();
  m.addEventListener('change',apply);
  addEventListener('storage',function(e){if(e.key==='theme')apply()});
  window.__applyTheme=apply;
})()
</script>

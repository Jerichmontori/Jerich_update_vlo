// Helpers for vMix 25 (legacy CEF browser engine) compatible overlays.
// Everything served through these helpers must stay ES5: no fetch, no arrow
// functions, no template literals, no CSS variables / flex gap.

export const VMIX_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      ...VMIX_CORS,
    },
  });
}

export function bgFromUrl(url: string) {
  const raw = new URL(url).searchParams.get("bg");
  if (!raw || raw === "transparent") return "transparent";
  return /^#/.test(raw) ? raw : "#" + raw;
}

export function baseStyles(bg: string) {
  return (
    "html,body{margin:0;padding:0;background:" +
    bg +
    ";font-family:Georgia,'Times New Roman',serif;color:#ffffff;-webkit-font-smoothing:antialiased;overflow:hidden;}" +
    "*{box-sizing:border-box;}" +
    ".gold{color:#C9A227;}" +
    ".panel{background:#7B2D26;background:-webkit-linear-gradient(315deg,rgba(123,45,38,.94),rgba(60,20,18,.9));" +
    "border-left:6px solid #C9A227;border-radius:14px;padding:22px 28px;" +
    "-webkit-box-shadow:0 20px 40px rgba(0,0,0,.45);box-shadow:0 20px 40px rgba(0,0,0,.45);text-shadow:0 2px 10px rgba(0,0,0,.7);}" +
    ".kicker{font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:5px;text-transform:uppercase;}" +
    ".hide{display:none;}"
  );
}

// ES5 XHR polling helper injected into every overlay page.
export const POLL_JS =
  "function vmixGet(url,cb){var x=new XMLHttpRequest();" +
  "x.open('GET',url+(url.indexOf('?')>-1?'&':'?')+'_t='+new Date().getTime(),true);" +
  "x.onreadystatechange=function(){if(x.readyState===4){if(x.status>=200&&x.status<300){" +
  "var d=null;try{d=JSON.parse(x.responseText);}catch(e){d=null;}if(d){cb(d);}}}};x.send();}" +
  "function vmixPoll(url,ms,cb){function run(){vmixGet(url,cb);}run();setInterval(run,ms);}" +
  "function vmixText(id,v){var el=document.getElementById(id);if(el){el.innerHTML=vmixEsc(v);}}" +
  "function vmixEsc(v){if(v===null||v===undefined){return '';}return String(v)" +
  ".replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}" +
  "function vmixShow(id,on){var el=document.getElementById(id);if(el){el.className=on?el.className.replace(/ ?hide/,''):(el.className.indexOf('hide')>-1?el.className:el.className+' hide');}}";

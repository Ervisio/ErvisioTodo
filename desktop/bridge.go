package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Wails blocks every JS-to-Go call from a remote origin, and this WebView2
// binding exposes no new-window or navigation hook. So the remote page gets a
// small script that asks Go for things by navigating to a URL on the embedded
// origin. Go answers 204, which makes the browser stay on the current page.
// (fetch and images are out: the server's CSP has connect-src 'self'.)
// The URL carries a per-launch secret, so only this script can use it.

func newToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func bridgeScript(origin, token string) string {
	if origin == "" {
		origin = "http://wails.localhost"
	}
	return fmt.Sprintf(bridgeJS, origin+"/__x/"+token+"/")
}

const bridgeJS = `(()=>{
if(window.__ervx)return;window.__ervx=1;
const P=%q;
const go=(a,u)=>{location.href=P+a+(u?"?u="+encodeURIComponent(u):"")};
const ext=u=>{try{return new URL(u,location.href).origin!==location.origin}catch(e){return false}};
const link=e=>{
  const a=e.target.closest&&e.target.closest("a[href]");
  if(!a||e.defaultPrevented||!/^(https?|mailto):/i.test(a.href)||(e.type==="auxclick"&&e.button!==1))return;
  if(ext(a.href)){e.preventDefault();go("open",a.href)}
};
document.addEventListener("click",link,true);
document.addEventListener("auxclick",link,true);
const open=window.open;
window.open=function(u,...r){if(u&&ext(u)){go("open",String(new URL(u,location.href)));return null}return open.call(this,u,...r)};
addEventListener("keydown",e=>{
  const k=e.key;
  if(k==="F5"||(e.ctrlKey&&!e.shiftKey&&!e.altKey&&(k==="r"||k==="R"))){e.preventDefault();go("reload")}
  else if(e.ctrlKey&&!e.altKey&&(k==="="||k==="+")){e.preventDefault();go("zoomin")}
  else if(e.ctrlKey&&!e.altKey&&k==="-"){e.preventDefault();go("zoomout")}
  else if(e.ctrlKey&&!e.altKey&&k==="0"){e.preventDefault();go("zoomreset")}
},true);
})();`

// bridgeHandler serves the AssetServer fallback: anything the embedded
// frontend does not contain lands here.
func (a *App) bridgeHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		action, ok := strings.CutPrefix(r.URL.Path, "/__x/"+a.token+"/")
		if !ok {
			http.NotFound(w, r)
			return
		}
		switch action {
		case "open":
			openExternal(a, r.URL.Query().Get("u"))
		case "reload":
			go a.reload()
		case "zoomin":
			go a.zoom(1)
		case "zoomout":
			go a.zoom(-1)
		case "zoomreset":
			go a.zoom(0)
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func openExternal(a *App, raw string) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "mailto") {
		return
	}
	runtime.BrowserOpenURL(a.ctx, u.String())
}

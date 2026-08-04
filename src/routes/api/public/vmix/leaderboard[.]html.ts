import { createFileRoute } from "@tanstack/react-router";
import { VMIX_CORS, htmlResponse, bgFromUrl, baseStyles, POLL_JS } from "@/lib/vmix-legacy";

export const Route = createFileRoute("/api/public/vmix/leaderboard.html")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const bg = bgFromUrl(request.url);
        const limit = Number(new URL(request.url).searchParams.get("limit") || 10) || 10;
        const html =
          "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
          "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">" +
          "<title>vMix Live Ranking</title><style>" +
          baseStyles(bg) +
          "#wrap{position:absolute;left:40px;top:40px;width:760px;}" +
          "table{width:100%;border-collapse:collapse;margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:18px;}" +
          "td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.18);}" +
          "td.r{width:48px;color:#C9A227;font-weight:bold;}" +
          "td.v{text-align:right;font-weight:bold;color:#C9A227;}" +
          "</style></head><body>" +
          "<div id=\"wrap\" class=\"panel hide\">" +
          "<div class=\"kicker gold\">Live Ranking</div>" +
          "<table><tbody id=\"tbody\"></tbody></table></div>" +
          "<script>" +
          POLL_JS +
          "var LIMIT=" +
          limit +
          ";var last='';" +
          "vmixPoll('/api/public/live.json',2000,function(d){" +
          "var r=(d&&d.ranking)?d.ranking:[];" +
          "if(!r.length){vmixShow('wrap',false);return;}" +
          "vmixShow('wrap',true);var h='';var i;" +
          "for(i=0;i<r.length&&i<LIMIT;i++){h+='<tr><td class=\"r\">'+(i+1)+'</td><td>'+vmixEsc(r[i].nama)+" +
          "'</td><td class=\"v\">'+vmixEsc(r[i].nilai_akhir!==undefined&&r[i].nilai_akhir!==null?r[i].nilai_akhir:'-')+'</td></tr>';}" +
          "if(h!==last){last=h;document.getElementById('tbody').innerHTML=h;}});" +
          "</script></body></html>";
        return htmlResponse(html);
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: VMIX_CORS }),
    },
  },
});

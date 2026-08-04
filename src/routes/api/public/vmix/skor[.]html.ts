import { createFileRoute } from "@tanstack/react-router";
import { VMIX_CORS, htmlResponse, bgFromUrl, baseStyles, POLL_JS } from "@/lib/vmix-legacy";

export const Route = createFileRoute("/api/public/vmix/skor.html")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const bg = bgFromUrl(request.url);
        const html =
          "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
          "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">" +
          "<title>vMix Pengumuman Nilai</title><style>" +
          baseStyles(bg) +
          "#wrap{position:absolute;left:50%;top:50%;margin-left:-430px;margin-top:-190px;width:860px;}" +
          "#nama{font-size:42px;font-weight:bold;margin-top:6px;}" +
          "#asal{font-size:18px;opacity:.85;margin-top:2px;}" +
          "table{width:100%;border-collapse:collapse;margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:17px;}" +
          "td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.18);}" +
          "td.v{text-align:right;font-weight:bold;color:#C9A227;}" +
          "#akhirBox{margin-top:18px;text-align:right;}" +
          "#akhir{font-size:64px;font-weight:bold;color:#C9A227;line-height:1;}" +
          "</style></head><body>" +
          "<div id=\"wrap\" class=\"panel hide\">" +
          "<div class=\"kicker gold\">Nomor Urut <span id=\"nomor\"></span> &middot; Hasil Penilaian</div>" +
          "<div id=\"nama\"></div><div id=\"asal\"></div>" +
          "<table id=\"tbl\"><tbody id=\"tbody\"></tbody></table>" +
          "<div id=\"akhirBox\"><div class=\"kicker gold\">Nilai Akhir</div><div id=\"akhir\">-</div></div>" +
          "</div><script>" +
          POLL_JS +
          "var lastRows='';" +
          "vmixPoll('/api/public/skor.json',1000,function(d){" +
          "var p=d?d.peserta:null;" +
          "if(!p){vmixShow('wrap',false);return;}" +
          "vmixShow('wrap',true);" +
          "vmixText('nomor',p.nomor_urut);vmixText('nama',p.nama);vmixText('asal',p.asal);" +
          "var juri=d.juri||[];var h='';var i;" +
          "for(i=0;i<juri.length;i++){h+='<tr><td>'+vmixEsc(juri[i].nama_juri||juri[i].nama||('Juri '+(i+1)))+" +
          "'</td><td class=\"v\">'+vmixEsc(juri[i].nilai!==undefined&&juri[i].nilai!==null?juri[i].nilai:'-')+'</td></tr>';}" +
          "if(h!==lastRows){lastRows=h;document.getElementById('tbody').innerHTML=h;}" +
          "vmixText('akhir',(d.running||d.nilai_akhir===null||d.nilai_akhir===undefined)?'...':d.nilai_akhir);});" +
          "</script></body></html>";
        return htmlResponse(html);
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: VMIX_CORS }),
    },
  },
});

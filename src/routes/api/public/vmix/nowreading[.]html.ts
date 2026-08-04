import { createFileRoute } from "@tanstack/react-router";
import { VMIX_CORS, htmlResponse, bgFromUrl, baseStyles, POLL_JS } from "@/lib/vmix-legacy";

export const Route = createFileRoute("/api/public/vmix/nowreading.html")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const bg = bgFromUrl(request.url);
        const html =
          "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
          "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">" +
          "<title>vMix Sedang Tampil</title><style>" +
          baseStyles(bg) +
          "body{padding:40px;}#wrap{position:absolute;left:40px;bottom:40px;max-width:840px;}" +
          "#nama{font-size:44px;font-weight:bold;line-height:1.1;margin-top:6px;}" +
          "#asal{font-size:18px;opacity:.85;margin-top:4px;}" +
          "#bacaanRow{margin-top:14px;font-size:24px;}" +
          "#kategori{display:inline-block;margin-top:14px;background:#C9A227;color:#3a1e12;" +
          "font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;}" +
          "</style></head><body>" +
          "<div id=\"wrap\" class=\"panel hide\">" +
          "<div class=\"kicker gold\">Nomor Urut <span id=\"nomor\"></span> &middot; Sedang Tampil</div>" +
          "<div id=\"nama\"></div><div id=\"asal\"></div>" +
          "<div id=\"bacaanRow\"><span class=\"kicker gold\">Bacaan</span> <span id=\"bacaan\"></span></div>" +
          "<div id=\"kategori\"></div></div>" +
          "<script>" +
          POLL_JS +
          "vmixPoll('/api/public/live.json',1500,function(d){" +
          "var a=(d&&d.active&&d.active.length)?d.active[0]:null;" +
          "if(!a){vmixShow('wrap',false);return;}" +
          "vmixText('nomor',a.nomor_urut);vmixText('nama',a.nama);vmixText('asal',a.asal);" +
          "vmixText('bacaan',(a.bacaan||'-')+(a.jumlah_ayat?(' ('+a.jumlah_ayat+' ayat)'):''));" +
          "vmixText('kategori',a.kategori);vmixShow('wrap',true);});" +
          "</script></body></html>";
        return htmlResponse(html);
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: VMIX_CORS }),
    },
  },
});

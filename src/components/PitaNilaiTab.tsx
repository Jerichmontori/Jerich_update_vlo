import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, RefreshCw } from "lucide-react";

export type PitaRow = {
  clear_text: boolean;
  label: string;
  batas_bawah: string;
  batas_atas: string;
  urutan: number;
  deskripsi: string;
  aktif: boolean;
};

type KategoriBatas = { kategori: string; batas_bawah: number; batas_atas: number };

function emptyRow(clearText: boolean, urutan: number): PitaRow {
  return {
    clear_text: clearText,
    label: clearText ? "Pita clear text" : "Tidak clear text",
    batas_bawah: "",
    batas_atas: "",
    urutan,
    deskripsi: "",
    aktif: true,
  };
}

export default function PitaNilaiTab() {
  const [kategoriList, setKategoriList] = useState<KategoriBatas[]>([]);
  const [kategori, setKategori] = useState<string>("");
  const [rows, setRows] = useState<PitaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gunakan, setGunakan] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  const batasKategori = useMemo(
    () => kategoriList.find((k) => k.kategori.toLowerCase() === kategori.trim().toLowerCase()),
    [kategoriList, kategori],
  );

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("kategori")
        .select("kategori, kriteria_peserta, batas_bawah, batas_atas")
        .order("updated_at", { ascending: false });
      if (error) return toast.error(error.message);
      const list: KategoriBatas[] = [];
      (data ?? []).forEach((k: any) => {
        const nama = String(k.kriteria_peserta || k.kategori || "").trim();
        if (!nama || list.some((x) => x.kategori.toLowerCase() === nama.toLowerCase())) return;
        list.push({ kategori: nama, batas_bawah: Number(k.batas_bawah), batas_atas: Number(k.batas_atas) });
      });
      setKategoriList(list);
      if (list.length && !kategori) setKategori(list[0].kategori);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(kat: string) {
    if (!kat) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_pita_nilai", { _kategori: kat });
    setLoading(false);
    if (error) return toast.error(error.message);
    const obj = (data as any) ?? {};
    setGunakan(obj.gunakan !== false);
    const arr: any[] = Array.isArray(obj) ? obj : obj.pita ?? [];
    setRows(
      arr.map((p) => ({
        clear_text: !!p.clear_text,
        label: p.label ?? "",
        batas_bawah: String(p.batas_bawah ?? ""),
        batas_atas: String(p.batas_atas ?? ""),
        urutan: Number(p.urutan ?? 0),
        deskripsi: p.deskripsi ?? "",
        aktif: p.aktif !== false,
      })),
    );
  }

  async function toggleGunakan(on: boolean) {
    if (!kategori) return;
    setToggleLoading(true);
    const { error } = await supabase.rpc("admin_set_gunakan_pita", {
      _kategori: kategori,
      _on: on,
    });
    setToggleLoading(false);
    if (error) {
      const msg = /hanya admin/i.test(error.message)
        ? "Hanya admin yang dapat mengubah pengaturan pita"
        : error.message;
      return toast.error(msg);
    }
    setGunakan(on);
    toast.success(on ? "Pita nilai diaktifkan untuk kategori ini" : "Pita nilai dimatikan; nilai kini memakai rumus lama");
  }

  useEffect(() => {
    if (kategori) load(kategori);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori]);

  function update(i: number, patch: Partial<PitaRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function tambah(clearText: boolean) {
    const same = rows.filter((r) => r.clear_text === clearText);
    setRows((prev) => [...prev, emptyRow(clearText, same.length + 1)]);
  }

  function hapus(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validasi(): string | null {
    for (const r of rows) {
      const bb = Number(r.batas_bawah);
      const ba = Number(r.batas_atas);
      if (!r.label.trim()) return "Label pita wajib diisi";
      if (!Number.isFinite(bb) || !Number.isFinite(ba)) return `Batas pita "${r.label}" belum lengkap`;
      if (ba < bb) return `Batas atas "${r.label}" lebih kecil dari batas bawah`;
      if (batasKategori && (bb < batasKategori.batas_bawah || ba > batasKategori.batas_atas)) {
        return `Pita "${r.label}" di luar rentang kategori ${batasKategori.batas_bawah}–${batasKategori.batas_atas}`;
      }
    }
    for (const ct of [true, false]) {
      const sorted = rows
        .filter((r) => r.clear_text === ct && r.aktif)
        .sort((a, b) => a.urutan - b.urutan || Number(a.batas_bawah) - Number(b.batas_bawah));
      for (let i = 1; i < sorted.length; i++) {
        if (Number(sorted[i].batas_bawah) < Number(sorted[i - 1].batas_atas)) {
          return `Pita "${sorted[i].label}" tumpang tindih dengan "${sorted[i - 1].label}"`;
        }
      }
    }
    return null;
  }

  async function simpan() {
    const err = validasi();
    if (err) return toast.error(err);
    setSaving(true);
    const payload = rows.map((r) => ({
      clear_text: r.clear_text,
      label: r.label.trim(),
      batas_bawah: Number(r.batas_bawah),
      batas_atas: Number(r.batas_atas),
      urutan: r.urutan,
      deskripsi: r.deskripsi || null,
      aktif: r.aktif,
    }));
    const { error } = await supabase.rpc("admin_set_pita_nilai", { _kategori: kategori, _pita: payload as any });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pita nilai disimpan");
    load(kategori);
  }

  async function hitungUlang() {
    const t = toast.loading("Menghitung ulang nilai...");
    const { error } = await supabase.rpc("refresh_nilai_cache");
    toast.dismiss(t);
    if (error) {
      const msg = /permission denied|hanya admin/i.test(error.message)
        ? "Hanya admin yang dapat menghitung ulang nilai"
        : error.message;
      return toast.error(msg);
    }
    toast.success("Nilai berhasil dihitung ulang mengikuti pita terbaru");
  }


  function renderGroup(clearText: boolean) {
    const idxs = rows.map((r, i) => i).filter((i) => rows[i].clear_text === clearText);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">{clearText ? "Pita Clear Text" : "Pita Tidak Clear Text"}</h4>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => tambah(clearText)}>
            <Plus className="size-4" /> Tambah Pita
          </Button>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Urut</TableHead>
                <TableHead className="min-w-48">Label</TableHead>
                <TableHead className="w-32 text-center">Batas Bawah</TableHead>
                <TableHead className="w-32 text-center">Batas Atas</TableHead>
                <TableHead className="min-w-64">Deskripsi</TableHead>
                <TableHead className="w-20 text-center">Aktif</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {idxs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Belum ada pita.
                  </TableCell>
                </TableRow>
              )}
              {idxs.map((i) => {
                const r = rows[i];
                return (
                  <TableRow key={`${clearText}-${i}`}>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.urutan}
                        onChange={(e) => update(i, { urutan: Number(e.target.value) || 0 })}
                        className="text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.001"
                        value={r.batas_bawah}
                        onChange={(e) => update(i, { batas_bawah: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.001"
                        value={r.batas_atas}
                        onChange={(e) => update(i, { batas_atas: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={r.deskripsi}
                        onChange={(e) => update(i, { deskripsi: e.target.value })}
                        rows={3}
                        className="min-w-72 resize-y"
                        placeholder="Deskripsi pita…"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.aktif} onCheckedChange={(v) => update(i, { aktif: v })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => hapus(i)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pita Nilai Clear Text</CardTitle>
        <CardDescription>
          Atur sendiri rentang angka untuk peserta clear text maupun tidak clear text. Nilai akhir juri akan dipetakan ke
          pita ini secara berurutan. Kategori tanpa pita tetap memakai perhitungan lama.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Kategori</Label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger>
                <SelectValue placeholder={kategoriList.length ? "Pilih kategori" : "Belum ada kategori"} />
              </SelectTrigger>
              <SelectContent>
                {kategoriList.map((k) => (
                  <SelectItem key={k.kategori} value={k.kategori}>
                    {k.kategori}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground sm:col-span-2">
            {batasKategori
              ? `Rentang kategori: ${batasKategori.batas_bawah} – ${batasKategori.batas_atas}`
              : "Pilih kategori untuk melihat rentangnya."}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="space-y-0.5">
            <div className="font-medium">Gunakan pita nilai untuk kategori ini</div>
            <div className="text-sm text-muted-foreground">
              {gunakan
                ? "Nilai juri dipetakan ke pita di bawah."
                : "Dimatikan — nilai dihitung dengan rumus lama. Pita tersimpan tetap bisa diedit."}
            </div>
          </div>
          <Switch
            checked={gunakan}
            disabled={toggleLoading || !kategori}
            onCheckedChange={(v) => toggleGunakan(v)}
          />
        </div>
        {!gunakan && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Pita tidak sedang dipakai untuk kategori ini. Tekan "Hitung Ulang Nilai" setelah mengaktifkan agar nilai lama menyesuaikan.
          </div>
        )}

        {renderGroup(false)}
        {renderGroup(true)}

        <div className="flex flex-wrap gap-2">
          <Button onClick={simpan} disabled={saving || loading || !kategori} className="gap-1">
            <Save className="size-4" /> {saving ? "Menyimpan…" : "Simpan Pita"}
          </Button>
          <Button variant="outline" onClick={hitungUlang} className="gap-1">
            <RefreshCw className="size-4" /> Hitung Ulang Nilai
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

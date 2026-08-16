
revoke all on function public.seed_pita_untuk_kategori() from public, anon, authenticated;

do $$
declare k record;
begin
  for k in select * from public.kategori loop
    update public.kategori set updated_at = now() where id = k.id;
  end loop;
end $$;

insert into public.pita_nilai (kategori, clear_text, label, batas_bawah, batas_atas, urutan, deskripsi, aktif)
select kk.nama, p.clear_text, p.label,
  round(kk.bb + (p.batas_bawah - 81.0) / (82.999 - 81.0) * (kk.ba - kk.bb), 3),
  round(kk.bb + (p.batas_atas - 81.0) / (82.999 - 81.0) * (kk.ba - kk.bb), 3),
  p.urutan, p.deskripsi, p.aktif
from (
  select nullif(btrim(coalesce(kriteria_peserta, kategori)), '') as nama, batas_bawah as bb, batas_atas as ba
  from public.kategori
) kk
cross join lateral (select * from public.pita_nilai where kategori = 'P/KB') p
where kk.nama is not null
  and not exists (select 1 from public.pita_nilai x where lower(x.kategori) = lower(kk.nama));

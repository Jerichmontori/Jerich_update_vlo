
create or replace function public.seed_pita_untuk_kategori()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _nama text;
  _tpl text;
  _tb numeric; _ta numeric;
begin
  _nama := nullif(btrim(coalesce(new.kriteria_peserta, new.kategori)), '');
  if _nama is null then return new; end if;

  if exists (select 1 from public.pita_nilai where lower(kategori) = lower(_nama)) then
    return new;
  end if;

  select p.kategori into _tpl
  from public.pita_nilai p
  where lower(p.kategori) <> lower(_nama)
  group by p.kategori
  order by count(*) desc
  limit 1;

  if _tpl is null then return new; end if;

  select min(batas_bawah), max(batas_atas) into _tb, _ta
  from public.pita_nilai where kategori = _tpl;

  insert into public.pita_nilai (kategori, clear_text, label, batas_bawah, batas_atas, urutan, deskripsi, aktif)
  select _nama, p.clear_text, p.label,
    case when new.batas_atas > new.batas_bawah and _ta > _tb
      then round(new.batas_bawah + (p.batas_bawah - _tb) / (_ta - _tb) * (new.batas_atas - new.batas_bawah), 3)
      else p.batas_bawah end,
    case when new.batas_atas > new.batas_bawah and _ta > _tb
      then round(new.batas_bawah + (p.batas_atas - _tb) / (_ta - _tb) * (new.batas_atas - new.batas_bawah), 3)
      else p.batas_atas end,
    p.urutan, p.deskripsi, p.aktif
  from public.pita_nilai p
  where p.kategori = _tpl;

  return new;
end;
$$;

drop trigger if exists trg_seed_pita_kategori on public.kategori;
create trigger trg_seed_pita_kategori
after insert on public.kategori
for each row execute function public.seed_pita_untuk_kategori();

drop trigger if exists trg_seed_pita_kategori_upd on public.kategori;
create trigger trg_seed_pita_kategori_upd
after update of kriteria_peserta, kategori on public.kategori
for each row execute function public.seed_pita_untuk_kategori();

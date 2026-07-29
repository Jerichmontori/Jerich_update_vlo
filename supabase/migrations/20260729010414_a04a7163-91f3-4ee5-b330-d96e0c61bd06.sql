GRANT EXECUTE ON FUNCTION public.admin_list_penilaian() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_juri() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_penilaian() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_nilai_juri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_nilai_akhir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated;
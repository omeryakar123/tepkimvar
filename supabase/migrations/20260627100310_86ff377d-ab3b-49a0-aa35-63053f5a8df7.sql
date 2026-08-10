
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS brand_response text,
  ADD COLUMN IF NOT EXISTS brand_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS brand_response_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anon_name text;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE
  b record; i int;
  uids uuid[];
  titles text[] := ARRAY[
    'Sipariş hala teslim edilmedi, iletişim kurulamıyor','Hatalı tahsilat yapıldı iade bekliyorum',
    'Müşteri hizmetleri yanıt vermiyor','Ürün hasarlı ve eksik geldi',
    'İade onayı verildi ama paramı alamadım','Yanlış bilgilendirme sonucu mağdur oldum',
    'Uygulama sürekli hata veriyor','Hesabım haksız yere kapatıldı',
    'Kampanya koşulları uygulanmadı','Fatura tutarı sözleşmeyle uyumsuz',
    'Garanti kapsamına alınmıyor','Randevu sürekli erteleniyor',
    'Sözleşme feshi işleme alınmıyor','Çağrı merkezi defalarca aratıyor','Teknik servis sorunu çözmedi'
  ];
  bodies text[] := ARRAY[
    'Defalarca aradığım halde bir çözüm üretilemedi. Mağduriyetimin bir an önce giderilmesini talep ediyorum.',
    'Yaşadığım süreç tamamen profesyonellikten uzak. Hem maddi hem manevi olarak zarar gördüm.',
    'Konuyu çözmek için tüm makul adımları attım fakat firma tarafından net bir geri dönüş alamadım.',
    'Bu hatanın firma standartlarına uygun olmadığını düşünüyorum. Gerekli incelemenin yapılıp tarafıma açıklama yapılmasını bekliyorum.',
    'Bir hafta içinde geri dönüş yapılacağı söylendi ancak hala bir gelişme olmadı.'
  ];
  pt text; pb text; rr smallint; rs complaint_status; rd int; created timestamptz; new_id uuid;
BEGIN
  SELECT array_agg(p.id) INTO uids FROM public.profiles p
   JOIN public.user_roles ur ON ur.user_id=p.id WHERE ur.role='user';
  IF uids IS NULL OR array_length(uids,1) IS NULL THEN
    SELECT array_agg(id) INTO uids FROM public.profiles LIMIT 5;
  END IF;

  FOR b IN SELECT id, category_id FROM public.brands ORDER BY created_at LIMIT 80 LOOP
    FOR i IN 1..(1 + (random()*2)::int) LOOP
      pt := titles[1 + (random() * (array_length(titles,1)-1))::int];
      pb := bodies[1 + (random() * (array_length(bodies,1)-1))::int];
      rr := 1 + (random()*4)::int;
      rs := (ARRAY['pending','approved','in_review','answered','resolved']::complaint_status[])[1 + (random()*4)::int];
      rd := (random()*30)::int;
      created := now() - (rd || ' days')::interval - (random()*1440 || ' minutes')::interval;
      INSERT INTO public.complaints (user_id, brand_id, category_id, title, body, status, rating, views, votes, is_public, is_anonymous, anon_name, city, created_at, updated_at)
      VALUES (uids[1 + (random()*(array_length(uids,1)-1))::int], b.id, b.category_id, pt, pb, rs, rr,
              (random()*5000)::int, (random()*200)::int, true, true,
              (ARRAY['Ayşe K.','Mehmet D.','Zeynep T.','Ali Y.','Fatma Ö.','Burak E.','Selin A.','Emre G.','Merve U.','Kerem B.'])[1 + (random()*9)::int],
              (ARRAY['İstanbul','Ankara','İzmir','Bursa','Antalya','Konya','Adana','Trabzon'])[1 + (random()*7)::int],
              created, created)
      RETURNING id INTO new_id;
      IF random() < 0.5 AND rs IN ('answered','resolved') THEN
        UPDATE public.complaints SET
          brand_response = 'Merhaba, yaşadığınız sorun için üzgünüz. Konuyu inceleyip en kısa sürede çözüme kavuşturmak için ilgili ekibimizi yönlendirdik. Anlayışınız için teşekkür ederiz.',
          brand_response_at = created + (random()*120 || ' minutes')::interval
        WHERE id = new_id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

UPDATE public.brands b SET
  rating = COALESCE((SELECT round(avg(rating)::numeric,1) FROM public.complaints WHERE brand_id=b.id AND rating IS NOT NULL),0),
  rating_count = COALESCE((SELECT count(*) FROM public.complaints WHERE brand_id=b.id AND rating IS NOT NULL),0),
  total_complaints = COALESCE((SELECT count(*) FROM public.complaints WHERE brand_id=b.id),0),
  complaints_resolved = COALESCE((SELECT count(*) FROM public.complaints WHERE brand_id=b.id AND status='resolved'),0),
  complaints_pending = COALESCE((SELECT count(*) FROM public.complaints WHERE brand_id=b.id AND status IN ('pending','approved','in_review')),0),
  resolution_rate = CASE WHEN (SELECT count(*) FROM public.complaints WHERE brand_id=b.id) > 0
                         THEN (100 * (SELECT count(*) FROM public.complaints WHERE brand_id=b.id AND status='resolved') / GREATEST((SELECT count(*) FROM public.complaints WHERE brand_id=b.id),1))
                         ELSE 0 END,
  avg_response_minutes = COALESCE((SELECT (avg(EXTRACT(EPOCH FROM (brand_response_at - created_at))/60))::int FROM public.complaints WHERE brand_id=b.id AND brand_response_at IS NOT NULL), 60);

INSERT INTO public.videos (slug, title, description, cover_url, video_url, status, views, likes) VALUES
  ('tuketici-haklari-rehberi','Tüketici Hakları Rehberi 2026','Bilmeniz gereken temel tüketici haklarınız tek videoda.','https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1280','https://www.w3schools.com/html/mov_bbb.mp4','published',12450,820),
  ('iade-sureci-nasil-isler','İade Süreci Nasıl İşler?','E-ticarette iade ve cayma hakkınızı doğru kullanın.','https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1280','https://www.w3schools.com/html/mov_bbb.mp4','published',8430,512),
  ('kargo-magduriyeti','Kargo Mağduriyetinde Adım Adım Çözüm','Hasarlı veya kayıp kargo durumunda yapmanız gerekenler.','https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1280','https://www.w3schools.com/html/mov_bbb.mp4','published',6210,402),
  ('banka-itirazlari','Banka İtirazlarında Dikkat Edilmesi Gerekenler','Haksız tahsilat ve yetkisiz işlemlerde resmi süreç.','https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=1280','https://www.w3schools.com/html/mov_bbb.mp4','published',4320,310)
ON CONFLICT (slug) DO NOTHING;


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; uname text; i int := 0;
BEGIN
  base := split_part(new.email,'@',1);
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    i := i + 1;
    uname := base || i::text;
    IF i > 50 THEN uname := base || substr(md5(random()::text),1,6); EXIT; END IF;
  END LOOP;
  INSERT INTO public.profiles (id, full_name, username, avatar_url)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), uname, new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
  RETURN new;
END $$;

INSERT INTO public.brands (slug, name, about, verified, is_active, category_id)
VALUES
 ('kazansana','Kazansana','Online eğlence platformu.', true, true, '28c05000-07b2-49fc-ab3e-3673e7f48681'),
 ('hadibet','HadiBet','Online eğlence platformu.', true, true, '28c05000-07b2-49fc-ab3e-3673e7f48681'),
 ('padisahbet','Padişahbet','Online eğlence platformu.', true, true, '28c05000-07b2-49fc-ab3e-3673e7f48681'),
 ('betkazan','Betkazan','Online eğlence platformu.', true, true, '28c05000-07b2-49fc-ab3e-3673e7f48681')
ON CONFLICT (slug) DO NOTHING;
insert into businesses(slug, name, tagline, brand_primary, brand_soft, goal, reward, eligible_service)
values ('ibloom', 'I Bloom Spa', 'Tu bienestar tiene recompensa.', '#b8416b', '#fbe3ea', 6, 'Facial de cortesía', 'Faciales y masajes')
on conflict (slug) do nothing;

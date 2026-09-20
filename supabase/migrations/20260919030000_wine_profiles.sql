alter table public.wines
  add column if not exists tasting_notes text;

comment on column public.wines.reference_notes is 'Editorial introduction or reference notes for the wine.';
comment on column public.wines.tasting_notes is 'Reusable bottle-level tasting profile; dinner-specific notes belong to wine_experiences.';
comment on column public.wines.label_photo_path is 'Private dinner-media storage path for the wine label image.';

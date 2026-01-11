Setup: Odometer photo storage

This app uploads odometer photos to a Supabase Storage bucket named `odometer-photos` and uses public URLs.

1) Create the bucket (public):
   - In Supabase UI > Storage > New bucket
   - Name: odometer-photos
   - Public: Yes (or set to private and use signed URLs)

2) Optional: Set bucket RLS or file policies as needed; public buckets make reading images from the app simple.

3) If you prefer private buckets, change `getPublicUrl` usage in `startShift` to use signed URLs instead.

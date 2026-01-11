Driver & Vehicle automatic resolution

What I added:

- `src/state/DriverContext.tsx` — new context that resolves auth user -> driver record -> assigned vehicle. Exposes:
  - `currentDriver` (drivers row or null)
  - `currentVehicle` (vehicle row or null)
  - `authUserId` (supabase auth UID)
  - `loading` & `reload()`

- App wiring
  - Wrapped the app in `<DriverProvider>` in `App.tsx` and made `AppStateProvider` consume `useDriver()`.
  - `AppState` now includes `driverRecordId` and will set `vehicleId`/`assignedVehicle` automatically when a driver has a single assigned vehicle.

- Odometer submission
  - `startShift` will upload a local odometer photo (if provided) to the `odometer-photos` bucket and insert the odometer reading and photo url into `shifts` as `odometer_reading` and `odometer_photo_url`.
  - The `ReadingsAndPhotosScreen` now blocks submit and shows a clear message when the driver has no assigned vehicle; when a single assigned vehicle exists the app auto-uses it.

- RLS & DB
  - SQL policy examples in `sql/rls_driver_policies.sql` to restrict drivers to their own rows (drivers, vehicles assigned to them, driver_vehicles, odometer entries, shifts).
  - Database helper `sql/add_shifts_odometer_columns.sql` to add `odometer_reading` and `odometer_photo_url` columns on `shifts` if needed.

Notes & next steps:
- Ensure a Supabase Storage bucket `odometer-photos` exists (see `docs/ODOMETER_STORAGE.md`).
- Verify column/table names in your DB match the examples; adjust SQL as necessary.
- Consider using signed URLs for private buckets if you need restricted access.

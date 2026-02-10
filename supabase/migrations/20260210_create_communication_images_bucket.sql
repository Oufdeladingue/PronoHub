-- Migration: Bucket Storage pour images de communications admin
-- Description: Crée le bucket public pour stocker les images des communications

-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'communication-images',
  'communication-images',
  true, -- Public en lecture
  5242880, -- 5MB max par fichier
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politique: Lecture publique
CREATE POLICY "Public read access on communication-images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'communication-images');

-- Politique: Upload réservé aux super_admin
CREATE POLICY "Super admin upload access on communication-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'communication-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Politique: Update réservé aux super_admin
CREATE POLICY "Super admin update access on communication-images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'communication-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Politique: Delete réservé aux super_admin
CREATE POLICY "Super admin delete access on communication-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'communication-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

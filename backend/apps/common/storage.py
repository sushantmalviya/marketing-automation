from cloudinary_storage.storage import MediaCloudinaryStorage

class AutoCloudinaryStorage(MediaCloudinaryStorage):
    def _get_resource_type(self, name):
        """
        Always return 'auto' so Cloudinary infers the resource type
        (image, video, or raw) from the file content itself.
        This enables uploading PDFs, CSVs, and images seamlessly
        without requiring python-magic to be installed.
        """
        return 'auto'

    def _get_url(self, name):
        """
        django-cloudinary-storage uses _get_resource_type to build the URL.
        Since we return 'auto' above, it generates a delivery URL with /auto/upload/.
        Cloudinary rejects delivery requests to /auto/upload/ (returns 400).
        We must rewrite /auto/upload/ to /image/upload/, /video/upload/, or /raw/upload/
        based on the file extension.
        """
        url = super()._get_url(name)
        
        import os
        ext = os.path.splitext(name)[1].lower().lstrip(".")
        
        if ext in {"mp4", "mov", "avi", "mkv", "webm", "m4v"}:
            delivery_type = "video"
        elif ext and ext not in {"jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "tiff"}:
            delivery_type = "raw"
        else:
            # If no extension or image extension, default to image (Cloudinary strips image exts by default)
            delivery_type = "image"
            
        return url.replace("/auto/upload/", f"/{delivery_type}/upload/")

# Project decisions

- Use the uploaded FITFLOW symbol as a transparent CDN asset for the app and a local resized PNG for the favicon; this keeps the brand consistent without adding a large image to source control.
- Keep `mpteam` as the existing internal modality identifier while displaying FITFLOW; changing persisted identifiers would break historical student records.
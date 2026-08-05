export async function uploadMediaFile(file) {
  if (!file) {
    throw new Error('Es wurde keine Datei zum Hochladen ausgewählt.');
  }

  return {
    fileName: file.name,
    status: 'pending',
  };
}

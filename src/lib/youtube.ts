export async function uploadToYouTube(
  fileData: Blob, 
  title: string, 
  description: string, 
  accessToken: string,
  onProgress: (progress: number) => void
) {
  // 1. Initial request to get the resumable upload URL
  const metadata = {
    snippet: {
      title,
      description,
      categoryId: '10' // Music
    },
    status: {
      privacyStatus: 'private', // Default to private
      selfDeclaredMadeForKids: false
    }
  };

  const res1 = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': fileData.size.toString(),
      'X-Upload-Content-Type': 'video/mp4'
    },
    body: JSON.stringify(metadata)
  });

  if (!res1.ok) {
     throw new Error(`Failed to initialize upload: ${await res1.text()}`);
  }

  const uploadUrl = res1.headers.get('Location');
  if (!uploadUrl) {
     throw new Error('Upload URL not found in response');
  }

  // 2. Upload the file data using XHR for progress events
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    // Note: Do not send Authorization header for the PUT request for Resumable Upload
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
         onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
         const response = JSON.parse(xhr.responseText);
         resolve(`https://youtube.com/watch?v=${response.id}`);
      } else {
         reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error occurred during upload.'));

    xhr.send(fileData);
  });
}

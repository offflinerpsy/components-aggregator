import { request } from 'undici';

export async function fetchText(url, options = {}) {
  try {
    const { body, statusCode } = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers
      },
      ...options
    });
    
    const text = await body.text();
    return { success: true, text, status: statusCode };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

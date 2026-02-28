import axios from 'axios';

const SCRAPER_API_KEY = 'a8ab4db6f7461638dbc59dfa2aef17d2';

async function testProxy() {
  const imei = '359226721131207';
  const uniqueTac = imei.substring(0, 8);
  // Use the same search query as the service
  const searchUrl = `https://www.google.com/search?q=TAC+${uniqueTac}+device`;

  console.log(`Testing Proxy for TAC: ${uniqueTac}`);
  console.log(`Target URL: ${searchUrl}`);

  try {
    const response = await axios.get('http://api.scraperapi.com', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: searchUrl,
        country_code: 'us',
        device_type: 'desktop',
      },
    });

    console.log('Status:', response.status);
    const html = response.data;
    console.log('Got HTML length:', html.length);

    const brands = [
      'Apple',
      'Samsung',
      'Xiaomi',
      'Motorola',
      'Google',
      'Huawei',
      'Honor',
      'Oppo',
      'Vivo',
      'Realme',
    ];
    const textContent = html.replace(/<[^>]*>/g, ' ');

    let detected = null;

    for (const brand of brands) {
      if (new RegExp(brand, 'i').test(textContent)) {
        // Try to grab context
        const regex = new RegExp(`${brand}\\s+([A-Za-z0-9\\s\\+\\-]{2,20})`, 'i');
        const match = textContent.match(regex);
        if (match && match[1]) {
          detected = `${brand} ${match[1].trim()}`;
          break;
        }
      }
    }

    if (detected) {
      console.log('✅ SUCCESS! Detected:', detected);
    } else {
      console.log('❌ FAILED to detect brand in HTML.');
      console.log('snippet:', textContent.substring(0, 500));
    }
  } catch (error: unknown) {
    const err = error as Error & { response?: { data: unknown } };
    console.error('Proxy Error:', err.message);
    if (err.response) {
      console.error('Data:', err.response.data);
    }
  }
}

testProxy();

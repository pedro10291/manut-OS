export function obterGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: pos.coords.accuracy
        });
      },
      () => reject(new Error("Permissão de GPS negada"))
    );
  });
}

export async function gerarValidacao() {
  let gps = null;
  try {
    gps = await obterGPS();
  } catch (e) {
    console.warn("Não foi possível obter o GPS:", e.message);
  }
  return {
    data: new Date().toISOString(),
    userAgent: navigator.userAgent,
    plataforma: navigator.platform,
    idioma: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tela: `${screen.width}x${screen.height}`,
    gps
  };
}
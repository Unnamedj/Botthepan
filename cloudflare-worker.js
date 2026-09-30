// Cloudflare Worker - Script Decoder & Storage
// Endpoints: /store, /decode, /stats, /cleanup

// Importar pako para descompresión
// En el dashboard de Cloudflare, agrega en Build settings:
// import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Headers CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Manejar preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // ============ GET /decode?id=xxx ============
      if (path === '/decode' && request.method === 'GET') {
        const id = url.searchParams.get('id');

        if (!id || !isValidId(id)) {
          return jsonResponse(
            { error: 'ID inválido o no proporcionado' },
            400,
            corsHeaders
          );
        }

        const encoded = await env.SCRIPTS.get(id);
        if (!encoded) {
          return jsonResponse(
            { error: 'Script no encontrado o expirado' },
            404,
            corsHeaders
          );
        }

        try {
          // Descomprimir script
          const decompressed = await decompressScript(encoded);

          return new Response(decompressed, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': 'attachment; filename="script.lua"',
              'Cache-Control': 'no-cache',
              ...corsHeaders,
            },
          });
        } catch (error) {
          console.error('Decompression error:', error);
          return jsonResponse(
            { error: 'Error al descomprimir el script' },
            500,
            corsHeaders
          );
        }
      }

      // ============ POST /store ============
      if (path === '/store' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { script } = body;

          if (!script || script.trim().length === 0) {
            return jsonResponse(
              { error: 'Script no proporcionado' },
              400,
              corsHeaders
            );
          }

          if (script.length > 1048576) { // 1MB límite
            return jsonResponse(
              { error: 'Script demasiado grande (máximo 1MB)' },
              413,
              corsHeaders
            );
          }

          // Generar ID único
          const id = generateId();

          // Guardar en KV (30 días de expiración)
          await env.SCRIPTS.put(id, script, {
            expirationTtl: 30 * 24 * 60 * 60,
            metadata: {
              created_at: new Date().toISOString(),
              size: script.length,
            },
          });

          return jsonResponse(
            {
              success: true,
              id,
              url: `${url.origin}/decode?id=${id}`,
              expires_in: '30 days',
            },
            200,
            corsHeaders
          );
        } catch (error) {
          console.error('Store error:', error);
          return jsonResponse(
            { error: 'Error al almacenar el script' },
            400,
            corsHeaders
          );
        }
      }

      // ============ GET /stats?id=xxx ============
      if (path === '/stats' && request.method === 'GET') {
        const id = url.searchParams.get('id');

        if (!id) {
          return jsonResponse(
            { error: 'ID requerido' },
            400,
            corsHeaders
          );
        }

        try {
          const metadata = await env.SCRIPTS.getWithMetadata(id);

          if (!metadata.value) {
            return jsonResponse(
              { error: 'Script no encontrado' },
              404,
              corsHeaders
            );
          }

          return jsonResponse(
            {
              id,
              size: metadata.value.length,
              compressed_size: Math.round(metadata.value.length * 0.7),
              created_at: metadata.metadata?.created_at || 'unknown',
              expires_in: '30 days',
            },
            200,
            corsHeaders
          );
        } catch (error) {
          console.error('Stats error:', error);
          return jsonResponse(
            { error: 'Error al obtener estadísticas' },
            500,
            corsHeaders
          );
        }
      }

      // ============ DELETE /cleanup?id=xxx ============
      if (path === '/cleanup' && request.method === 'DELETE') {
        const id = url.searchParams.get('id');

        if (!id) {
          return jsonResponse(
            { error: 'ID requerido' },
            400,
            corsHeaders
          );
        }

        try {
          await env.SCRIPTS.delete(id);
          return jsonResponse(
            { success: true, message: 'Script eliminado' },
            200,
            corsHeaders
          );
        } catch (error) {
          console.error('Cleanup error:', error);
          return jsonResponse(
            { error: 'Error al eliminar el script' },
            500,
            corsHeaders
          );
        }
      }

      // ============ GET / (Health check) ============
      if (path === '/' && request.method === 'GET') {
        return jsonResponse(
          {
            status: 'online',
            service: 'MM2 Script Decoder',
            version: '1.0.0',
            endpoints: {
              'POST /store': 'Almacenar script comprimido',
              'GET /decode?id=xxx': 'Descargar y descomprimir script',
              'GET /stats?id=xxx': 'Obtener estadísticas del script',
              'DELETE /cleanup?id=xxx': 'Eliminar script',
            },
          },
          200,
          corsHeaders
        );
      }

      // Endpoint no encontrado
      return jsonResponse(
        { error: 'Endpoint no encontrado' },
        404,
        corsHeaders
      );
    } catch (error) {
      console.error('Unexpected error:', error);
      return jsonResponse(
        { error: 'Error interno del servidor' },
        500,
        corsHeaders
      );
    }
  },
};

// ============ FUNCIONES HELPER ============

function generateId() {
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isValidId(id) {
  return /^[a-f0-9]{16}$/.test(id);
}

async function decompressScript(encoded) {
  try {
    // Decodificar de base64
    const binaryString = atob(encoded);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Descomprimir con pako
    // NOTA: Necesitas agregar pako en el worker
    // En el editor de Cloudflare, agrega:
    // import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';

    if (typeof pako === 'undefined') {
      throw new Error('pako library not loaded. Add to worker: import pako from "https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js"');
    }

    const decompressed = pako.inflate(bytes, { to: 'string' });
    return decompressed;
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

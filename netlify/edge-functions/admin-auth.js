// Edge Function to protect /admin/* paths
// Runs at the CDN edge BEFORE content is served

export default async function handler(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow the main /admin page (login page) without auth
  if (path === '/admin' || path === '/admin/') {
    return context.next();
  }

  // Allow static assets
  if (path.includes('/_astro/') || path.includes('/favicon')) {
    return context.next();
  }

  // Check for session cookie
  const cookies = request.headers.get('cookie') || '';
  const sessionMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : null;

  if (!sessionToken) {
    // No session cookie - redirect to login
    return Response.redirect(new URL('/admin', request.url), 302);
  }

  // Validate session with server-side function
  try {
    const validateUrl = new URL('/.netlify/functions/admin-validate-session', request.url);
    const validateResponse = await fetch(validateUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionToken })
    });

    const result = await validateResponse.json();

    if (!result.valid) {
      // Invalid session - redirect to login
      return Response.redirect(new URL('/admin', request.url), 302);
    }

    // Valid session - allow request through
    return context.next();

  } catch (error) {
    console.error('Session validation error:', error);
    // On error, redirect to login for safety
    return Response.redirect(new URL('/admin', request.url), 302);
  }
}

// Path config is in netlify.toml: [[edge_functions]] path = "/admin/*"

const fallback = document.querySelector('#reference-fallback')

if (window.Scalar) {
  window.Scalar.createApiReference('#api-reference', {
    url: '/api-docs/openapi.json',
    persistAuth: false,
    hideTestRequestButton: true,
    hideClientButton: true,
    showDeveloperTools: 'never',
    withDefaultFonts: false,
  })
  fallback.hidden = true
}

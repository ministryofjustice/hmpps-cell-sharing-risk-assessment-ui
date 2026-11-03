/// <reference lib="dom" />

const initHistoryRevalidation = (): void => {
  if (!document.querySelector('[data-revalidate-on-history-restore]')) return

  window.addEventListener('pageshow', event => {
    // The back/forward cache can restore a page without rechecking its no-store response.
    if (event.persisted) window.location.reload()
  })
}

export default initHistoryRevalidation

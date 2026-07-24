/// <reference lib="dom" />

const toDirection = (ariaSort: string | null): 'ASC' | 'DESC' => (ariaSort === 'ascending' ? 'ASC' : 'DESC')

/**
 * Initializes the due-for-review sort form by observing changes to the table header cells' aria-sort attributes.
 * When a header cell is sorted, the corresponding hidden input fields for sort and direction are updated.
 * */
const initDueForReviewSortForm = (): void => {
  const form = document.querySelector<HTMLFormElement>('[data-due-for-review-form]')
  if (!form) return

  const sortField = form.querySelector<HTMLInputElement>('[data-sort-field]')
  const directionField = form.querySelector<HTMLInputElement>('[data-direction-field]')
  const table = form.querySelector<HTMLTableElement>('table[data-module="moj-sortable-table"]')

  if (!sortField || !directionField || !table) return

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'aria-sort') return

      const headerCell = mutation.target as HTMLTableCellElement
      const ariaSort = headerCell.getAttribute('aria-sort')
      if (!ariaSort || ariaSort === 'none') return

      const { sortKey } = headerCell.dataset
      if (!sortKey) return

      sortField.value = sortKey
      directionField.value = toDirection(ariaSort)
    })
  })

  const headerCells = table.querySelectorAll<HTMLTableCellElement>('th[data-sort-key]')
  headerCells.forEach(cell => observer.observe(cell, { attributes: true, attributeFilter: ['aria-sort'] }))
}

export default initDueForReviewSortForm

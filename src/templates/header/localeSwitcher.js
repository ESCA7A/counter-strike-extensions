document
  .querySelector('#language-switcher')
  ?.addEventListener('change', event => {
    const option = event.target.selectedOptions[0];

    if (option?.dataset.url) {
      window.location.href = option.dataset.url;
    }
  });
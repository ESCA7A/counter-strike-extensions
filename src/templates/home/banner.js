document.querySelectorAll('.project-slider').forEach(slider => {
  const track =
    slider.querySelector('[data-project-track]');

  const previous =
    slider.querySelector('[data-projects-prev]');

  const next =
    slider.querySelector('[data-projects-next]');

  if (!track || !previous || !next) {
    return;
  }

  const getStep = () => {
    const card =
      track.querySelector('.project-card');

    if (!card) {
      return track.clientWidth;
    }

    const styles =
      getComputedStyle(track);

    const gap =
      parseFloat(styles.columnGap || styles.gap) || 0;

    return card.getBoundingClientRect().width + gap;
  };

  previous.addEventListener('click', () => {
    track.scrollBy({
      left: -getStep(),
      behavior: 'smooth'
    });
  });

  next.addEventListener('click', () => {
    track.scrollBy({
      left: getStep(),
      behavior: 'smooth'
    });
  });
});
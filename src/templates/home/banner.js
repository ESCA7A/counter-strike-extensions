const track = document.querySelector('[data-project-track]');
const previousButton = document.querySelector('[data-projects-prev]');
const nextButton = document.querySelector('[data-projects-next]');

if (track && previousButton && nextButton) {
  const cards = Array.from(track.children);

  let currentIndex = 0;

  function updateSlider() {
    const currentCard = cards[currentIndex];

    if (!currentCard) {
      return;
    }

    track.style.transform =
      `translateX(-${currentCard.offsetLeft}px)`;

    previousButton.disabled =
      currentIndex === 0;

    nextButton.disabled =
      currentIndex === cards.length - 1;
  }

  previousButton.addEventListener('click', () => {
    if (currentIndex === 0) {
      return;
    }

    currentIndex -= 1;
    updateSlider();
  });

  nextButton.addEventListener('click', () => {
    if (currentIndex >= cards.length - 1) {
      return;
    }

    currentIndex += 1;
    updateSlider();
  });

  window.addEventListener('resize', updateSlider);

  updateSlider();
}
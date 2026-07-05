let count = 0;
const btn = document.querySelector('.btn');
if (btn) {
  btn.addEventListener('click', () => {
    count += 1;
    btn.textContent = `Clicked ${count} times`;
  });
}

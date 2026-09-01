// ========================================
// MENU MOBILE
// ========================================

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const header = document.querySelector(".header");


if (menuToggle) {

  menuToggle.addEventListener("click", () => {

    const open = nav.classList.toggle("open");

    document.body.classList.toggle("lock", open);

    menuToggle.setAttribute(
      "aria-expanded",
      open
    );

  });

}



// Fechar menu ao clicar em algum link

document
  .querySelectorAll(".nav a")
  .forEach((link) => {

    link.addEventListener("click", () => {

      nav.classList.remove("open");

      document.body.classList.remove("lock");

      menuToggle?.setAttribute(
        "aria-expanded",
        "false"
      );

    });

  });



// ========================================
// HEADER AO ROLAR
// ========================================

window.addEventListener(
  "scroll",
  () => {

    header.classList.toggle(
      "scrolled",
      window.scrollY > 40
    );

  },
  {
    passive: true
  }
);



// ========================================
// BOTÃO SCROLL
// ========================================

document
  .querySelectorAll("[data-scroll]")
  .forEach((button) => {

    button.addEventListener("click", () => {

      const target =
        document.querySelector(
          button.dataset.scroll
        );

      if (target) {

        target.scrollIntoView({
          behavior: "smooth"
        });

      }

    });

  });



// ========================================
// ANIMAÇÕES AO ENTRAR NA TELA
// ========================================

const revealObserver =
  new IntersectionObserver(

    (entries, observer) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          entry.target.classList.add(
            "visible"
          );

          observer.unobserve(
            entry.target
          );

        }

      });

    },

    {
      threshold: 0.12
    }

  );


document
  .querySelectorAll(
    ".reveal-on-scroll, .reveal-image"
  )
  .forEach((element) => {

    revealObserver.observe(element);

  });



// ========================================
// NÚMEROS ANIMADOS
// ========================================

const counters =
  document.querySelectorAll(
    "[data-count]"
  );


const counterObserver =
  new IntersectionObserver(

    (entries, observer) => {

      entries.forEach((entry) => {

        if (!entry.isIntersecting) {

          return;

        }


        const element =
          entry.target;

        const target =
          Number(element.dataset.count);

        const duration = 1300;

        const start =
          performance.now();


        function animateCounter(now) {

          const progress =
            Math.min(
              (now - start) / duration,
              1
            );


          const eased =
            1 -
            Math.pow(
              1 - progress,
              3
            );


          element.textContent =
            Math.floor(
              target * eased
            );


          if (progress < 1) {

            requestAnimationFrame(
              animateCounter
            );

          } else {

            element.textContent =
              target;

          }

        }


        requestAnimationFrame(
          animateCounter
        );


        observer.unobserve(
          element
        );

      });

    },

    {
      threshold: 0.5
    }

  );


counters.forEach((counter) => {

  counterObserver.observe(counter);

});



// ========================================
// MODAL DOS PROJETOS
// ========================================

const modal =
  document.querySelector(
    ".project-modal"
  );


const modalImage =
  document.querySelector(
    ".modal-image"
  );


const modalTitle =
  document.querySelector(
    "#modal-title"
  );


const modalLocation =
  document.querySelector(
    ".modal-location"
  );


const modalDescription =
  document.querySelector(
    ".modal-description"
  );


const closeModal = () => {

  modal.classList.remove(
    "open"
  );

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "lock"
  );

};



document
  .querySelectorAll(".project")
  .forEach((project) => {

    const button =
      project.querySelector(
        ".project-open"
      );


    button.addEventListener(
      "click",
      () => {

        const photo =
          project.querySelector(
            ".project-photo"
          );


        modalImage.style.backgroundImage =
          getComputedStyle(
            photo
          ).backgroundImage;


        modalTitle.textContent =
          project.dataset.project;


        modalLocation.textContent =
          project.dataset.location;


        modalDescription.textContent =
          project.dataset.description;


        modal.classList.add(
          "open"
        );


        modal.setAttribute(
          "aria-hidden",
          "false"
        );


        document.body.classList.add(
          "lock"
        );

      }
    );

  });



// Fechar botão

document
  .querySelector(".modal-close")
  ?.addEventListener(
    "click",
    closeModal
  );



// Fechar clicando fora

document
  .querySelector(".modal-backdrop")
  ?.addEventListener(
    "click",
    closeModal
  );



// Fechar com ESC

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape"
    ) {

      closeModal();

    }

  }
);



// ========================================
// LINK DO MODAL
// ========================================

document
  .querySelector(".modal-link")
  ?.addEventListener(
    "click",
    closeModal
  );



// ========================================
// CURSOR PERSONALIZADO
// ========================================

const cursor =
  document.querySelector(
    ".cursor"
  );


const follower =
  document.querySelector(
    ".cursor-follower"
  );


if (
  window.matchMedia(
    "(pointer:fine)"
  ).matches
) {

  document.body.classList.add(
    "cursor-ready"
  );


  let mouseX = 0;

  let mouseY = 0;

  let followX = 0;

  let followY = 0;


  window.addEventListener(
    "mousemove",
    (event) => {

      mouseX =
        event.clientX;

      mouseY =
        event.clientY;


      cursor.style.transform =
        `translate(
          ${mouseX - 3}px,
          ${mouseY - 3}px
        )`;

    }
  );


  function moveFollower() {

    followX +=
      (mouseX - followX) *
      0.16;


    followY +=
      (mouseY - followY) *
      0.16;


    follower.style.transform =
      `translate(
        ${followX - 17}px,
        ${followY - 17}px
      )`;


    requestAnimationFrame(
      moveFollower
    );

  }


  moveFollower();



  // ========================================
  // EFEITO MAGNÉTICO
  // ========================================

  document
    .querySelectorAll(
      ".magnetic"
    )
    .forEach((element) => {

      element.addEventListener(
        "mousemove",
        (event) => {

          const rect =
            element.getBoundingClientRect();


          const x =
            (
              event.clientX -
              rect.left -
              rect.width / 2
            ) * 0.12;


          const y =
            (
              event.clientY -
              rect.top -
              rect.height / 2
            ) * 0.12;


          element.style.transform =
            `translate(
              ${x}px,
              ${y}px
            )`;

        }
      );


      element.addEventListener(
        "mouseleave",
        () => {

          element.style.transform =
            "";

        }
      );

    });

}
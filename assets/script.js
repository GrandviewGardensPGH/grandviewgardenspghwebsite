document.addEventListener("DOMContentLoaded", () => {
    const debug = true;
    const log = (...messages) => {
        if (debug) console.log("[scroll-debug]", ...messages);
    };

    //selecting all key elements we are working with
    const container = document.querySelector(".container");
    const scroller = document.querySelector(".scroller");
    const progressCounter = document.querySelector(".progress-counter h1");
    const progressBar = document.querySelector(".progress-bar");
    const sections = Array.from(scroller.querySelectorAll("section"));

    log("initialized", {
        container: Boolean(container),
        scroller: Boolean(scroller),
        sections: sections.length,
    });

    const smoothFactor = 0.05;
    const touchSensitivity = 2.5;
    const bufferSize = 2;

    let targetScrollX = 0;
    let currentScrollX = 0;
    let isAnimating = false;
    let currentProgressScale = 0;
    let targetProgressScale = 0;
    let lastPercentage = 0;

    let isDown = false;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchVelocity = 0;
    let lastTouchTime = 0;

    //function that calcs distance 
    const larp = (start, end, factor) =>  start + (end - start) * factor;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    // Maps a section's distance from the viewport center to a reusable layer reveal.
    const updateScrollRevealLayers = () => {
        document.querySelectorAll("[data-scroll-reveal]").forEach((layer) => {
            const section = layer.closest("section");
            if (!section) return;

            const sectionLeft = section.getBoundingClientRect().left;
            const sectionWidth = section.getBoundingClientRect().width;
            const sectionProgress = clamp(
                0.5 - sectionLeft / (sectionWidth * 2),
                0,
                1
            );
            const distanceFromCenter = Math.abs(sectionProgress - 0.5) * 2;
            const easedCenterDistance =
                distanceFromCenter * distanceFromCenter * (3 - 2 * distanceFromCenter);
            const hiddenDistance = Number(layer.dataset.revealDistance || 28);
            const rotation = sectionProgress <= 0.5
                ? 270 + sectionProgress * 180
                : (sectionProgress - 0.5) * 180;
            const translateY = hiddenDistance * easedCenterDistance;

            layer.style.transform =
                `translate3d(0, ${translateY}%, 0) rotate(${rotation}deg)`;
        });
    };

    //function for duplicating sections at end for infinite scroll
    const setupScroll = () => {
        //first remove any clone sections from calculations (we only want original html sections)
        scroller
            .querySelectorAll(".clone-section")
            .forEach((clone) => clone.remove());
        const originalSections = Array.from(
            scroller.querySelectorAll("section:not(.clone-section)")
        );

        //if post clone removal, length is more than 0, set those as what we use for calc
        const templateSections =
            originalSections.length > 0 ? originalSections : sections;

        //calc width of all sections combined
        let sequenceWidth = 0;
        templateSections.forEach((section) => {
            sequenceWidth += parseFloat(window.getComputedStyle(section).width);
        });

        // Clone complete sequences on both sides so the track can loop.
        for (let i = 0; i < bufferSize; i++) {
            templateSections.slice().reverse().forEach((section, index) => {
                const clone = section.cloneNode(true);
                clone.classList.add("clone-section");
                clone.setAttribute("data-clone-index", `-${i + 1}-${index}`);
                scroller.prepend(clone);

            });
        };

        if (originalSections.length === 0) {
            templateSections.forEach((section,index) => {
                const clone = section.cloneNode(true);
                clone.setAttribute("data-clone-index",`0-${index}`);
                scroller.appendChild(clone);
            })
        }

        //cloning on both ends for smooth transition starts now (right side)
        for (let i = 0; i < bufferSize; i++) {
            templateSections.forEach((section, index) => {
                const clone = section.cloneNode(true);
                clone.classList.add("clone-section");
                clone.setAttribute("data-clone-index", `${i + 1}-${index}`);
                scroller.appendChild(clone);

            });
        };

        scroller.style.width = `${sequenceWidth * (1 + bufferSize * 2)}px`;
        targetScrollX = sequenceWidth * bufferSize;
        currentScrollX = targetScrollX;
        scroller.style.transform = `translateX(-${currentScrollX}px)`;

        log("setup complete", {
            sequenceWidth,
            totalSections: scroller.querySelectorAll("section").length,
            startOffset: currentScrollX,
        });

        return sequenceWidth;
    };

    //scroll never stop by adding more scroll (if past last or first section)
    const checkBoundaryAndReset = (sequenceWidth) => {
        
        //too far right
        if (currentScrollX > sequenceWidth * (bufferSize + 0.5)) {
            targetScrollX -= sequenceWidth;
            currentScrollX -= sequenceWidth;
            scroller.style.transform = `translateX(-${currentScrollX}px)`;
            return true;
        } 

        //too far left
        if (currentScrollX < sequenceWidth * (bufferSize - 0.5)) {
            targetScrollX += sequenceWidth;
            currentScrollX += sequenceWidth;
            scroller.style.transform = `translateX(-${currentScrollX}px)`;
            return true;
        } 

        return false;
    };

    //update progress bar at top based on these scroll loop logic
    const updateProgress = (sequenceWidth, forceReset = false) => {
        //base is center of loop
        const basePosition = sequenceWidth * bufferSize;
        //position relative to base value 
        const currentPosition = (currentScrollX - basePosition) % sequenceWidth;

        const normalizedPosition =
            (currentPosition + sequenceWidth) % sequenceWidth;
        const percentage = (normalizedPosition / sequenceWidth) * 100;

        const isWrapping =
        (lastPercentage > 80 && percentage < 20) ||
        (lastPercentage < 20 && percentage > 80) ||
        forceReset;

        progressCounter.textContent = `${Math.round(percentage)}`
        targetProgressScale = percentage / 100;

        if (isWrapping) {
            currentProgressScale = targetProgressScale;
            progressBar.style.transform = `scaleX(${currentProgressScale})`
        }

        lastPercentage = percentage;

    };

    //larpig is gradual move towards target
    let sequenceWidth = 0;

    const animate = (forceProgressReset = false) => {
        currentScrollX = larp(currentScrollX, targetScrollX, smoothFactor);
        scroller.style.transform = `translateX(-${currentScrollX}px)`;
        updateScrollRevealLayers();

        updateProgress(sequenceWidth, forceProgressReset);

        if(!forceProgressReset) {
            currentProgressScale = larp (
                currentProgressScale,
                targetProgressScale,
                smoothFactor
            );

            progressBar.style.transform = `scaleX(${currentProgressScale})`
        }

        if(Math.abs(targetScrollX - currentScrollX) < 0.01) {
            isAnimating = false;
        } else {
            requestAnimationFrame(() => animate())
        }
    };

    //scrolling response (touch and mouse)
    sequenceWidth = setupScroll();
    updateProgress(sequenceWidth, true);
    updateScrollRevealLayers();
    progressBar.style.transform = `scaleX(${currentProgressScale})`;

    let resizeTimer;
    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            const oldSequenceWidth = sequenceWidth;
            const oldPosition = currentScrollX - oldSequenceWidth * bufferSize;
            const progress = ((oldPosition % oldSequenceWidth) + oldSequenceWidth) % oldSequenceWidth / oldSequenceWidth;

            sequenceWidth = setupScroll();
            currentScrollX = sequenceWidth * bufferSize + progress * sequenceWidth;
            targetScrollX = currentScrollX;
            scroller.style.transform = `translateX(-${currentScrollX}px)`;
            updateProgress(sequenceWidth, true);
            updateScrollRevealLayers();
            progressBar.style.transform = `scaleX(${currentProgressScale})`;
            isAnimating = false;
        }, 100);
    });

    document.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();

            const sectionIndex = sections.findIndex(
                (section) => `#${section.id}` === link.getAttribute("href")
            );

            if (sectionIndex < 0) return;

            const sectionOffset = sections
                .slice(0, sectionIndex)
                .reduce(
                    (offset, section) =>
                        offset + parseFloat(window.getComputedStyle(section).width),
                    0
                );

            targetScrollX = sequenceWidth * bufferSize + sectionOffset;
            history.replaceState(null, "", link.getAttribute("href"));

            if (!isAnimating) {
                isAnimating = true;
                requestAnimationFrame(() => animate());
            }
        });
    });

    container.addEventListener("wheel", (e) => {
        e.preventDefault();
        targetScrollX += e.deltaY;

        log("wheel", {
            deltaY: e.deltaY,
            targetScrollX,
            currentScrollX,
        });

        const needReset = checkBoundaryAndReset(sequenceWidth);

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(()=> animate(needReset));
        }
    },
    { passive: false }
    );

    container.addEventListener("touchstart", (e) => {
        isDown = true;
        lastTouchX= e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        lastTouchTime = Date.now();
        targetScrollX = currentScrollX;
        log("touchstart", {
            isDown,
            lastTouchX,
            targetScrollX,
        });
    });

    container.addEventListener("touchmove", (e) => {
        if (!isDown) return;
        e.preventDefault();

        const currentTouchX = e.touches[0].clientX;
        const currentTouchY = e.touches[0].clientY;
        const horizontalDelta = lastTouchX - currentTouchX;
        const verticalDelta = lastTouchY - currentTouchY;
        const touchDelta =
            Math.abs(horizontalDelta) > Math.abs(verticalDelta)
                ? horizontalDelta
                : verticalDelta;

        targetScrollX += touchDelta * touchSensitivity;

        const currentTime = Date.now();
        const timeDelta = currentTime - lastTouchTime;
        if (timeDelta > 0) {
            touchVelocity = (touchDelta / timeDelta) * 15;
        }

        lastTouchX = currentTouchX;
        lastTouchY = currentTouchY;
        lastTouchTime = currentTime;

        const needReset = checkBoundaryAndReset(sequenceWidth);

        log("touch", {
            isDown,
            touchDelta,
            timeDelta,
            targetScrollX,
            currentTouchX,
            touchVelocity,
            needReset
        });

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(()=> animate(needReset));
        }
    });

    container.addEventListener("touchend", () => {
        isDown = false;
        log("touchend", {
            isDown,
        });
        

        if(Math.abs(touchVelocity) > 0.01) {
            targetScrollX += touchVelocity * 20;

            const decayVelocity = () => {
                touchVelocity *= 0.95;

                if(Math.abs(touchVelocity) > 0.01) {
                    targetScrollX += touchVelocity;
                    const needsReset = checkBoundaryAndReset(sequenceWidth);

                    if (needsReset) {
                        updateProgress(sequenceWidth,true);
                    }

                    requestAnimationFrame(decayVelocity);
                }
            };

            requestAnimationFrame(decayVelocity);
        } 
    },{ passive: false }
    );
});

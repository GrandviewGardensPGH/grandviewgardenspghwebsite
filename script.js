document.addEventListener("DOMContentLoaded", () => {
    //selecting all key elements we are working with
    const container = document.querySelector(".container");
    const scroller = document.querySelector(".scroller");
    const progressCounter = document.querySelector(".progress-counter h1");
    const progressBar = document.querySelector(".progress-bar");
    const sections = Array.from(scroller.querySelectorAll("section"));

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
    let touchVelocity = 0;
    let lastTouchTime = 0;

    //function that calcs distance 
    const larp = (start, end, factor) =>  start + (end - start) * factor;

    //function for duplicating sections at end for infinite scroll
    const setupScroll = () => {
        //first remove any clone sections from calculations (we only want original html sections)
        scroller
            .querySelectorAll(".clone-section")
            .forEach((clone) => clone.remove());
        const originalSections = Array.from(
            scroller.querySelectorAll("section:not(.clone-section")
        );

        //if post clone removal, length is more than 0, set those sections as what we use for calc
        const templateSections =
            originalSections.length > 0 ? originalSections : sections;

        //calc width of all sections combined
        let sequenceWidth = 0;
        templateSections.forEach((section) => {
            sequenceWidth += parseFloat(window.getComputedStyle(section).width);
        });

        //cloning on both ends for smooth transition starts now (left side)
        for (let i = -bufferSize; i=0;i++) {
            templateSections.forEach((section, index) => {
                const clone = section.cloneNode(true);
                clone.classList.add(".clone-section");
                clone.setAttribute("data-clone-index",`${i}-${index}`);
                scroller.appendChild(clone);

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
        for (let i = 1; i < bufferSize; i++) {
            templateSections.forEach((section, index) => {
                const clone = section.cloneNode(true);
                clone.classList.add(".clone-section");
                clone.setAttribute("data-clone-index",`${i}-${index}`);
                scroller.appendChild(clone);

            });
        };

        //scroller.style.width = `${sequenceWidth * (1 + bufferSize * 2)})px`;
        targetScrollX = sequenceWidth * bufferSize;
        currentScrollX = targetScrollX;
        scroller.style.transform = `translateX(-${currentScrollX}px)`

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

        let percentage = (currentPosition / basePosition) * 100;

        if (percentage < 0) {
            percentage = 100 + percentage;
        }

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

    };

    //larpig is gradual move towards target 
    const animate = (sequenceWidth, forceProgressReset = false) => {
        currentScrollX = larp(currentScrollX, targetScrollX, smoothFactor);
        scroller.style.transform = `transateX(-${currentScrollX}px)`;

        updateProgress(sequenceWidth,forceProgressReset);

        if(!forceProgressReset) {
            currentProgressScale = larp (
                currentProgressScale,
                targetProgressScale,
                smoothFactor
            );

            progressBar.style.translate = `scaleX(${currentProgressScale})`
        }

        if(Math.abs(targetScrollX - currentScrollX) < 0.01) {
            isAnimating = false;
        } else {
            requestAnimationFrame(() => animate(sequenceWidth))
        }
    };

    //scrolling response (touch and mouse)
    const sequenceWidth = setupScroll();
    updateProgress(sequenceWidth, true);
    progressBar.style.transform = `scaleX(${currentProgressScale})`;

    container.addEventListener("wheel", (e) => {
        e.preventDefault();
        targetScrollX += e.deltaY;

        const needReset = checkBoundaryAndReset(sequenceWidth);

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(()=> animate(sequenceWidth, needReset));
        }
    }, 
    {passive: false;}
    );

    container.addEventListener("touchstart", (e) => {
        isDown = true;
        lastTouchX= e.touches[0].clientX;
        lastTouchTime = Date.now();
        targetScrollX = currentScrollX;
    });

    container.addEventListener("touchmove", (e) => {
        if (!isDown) return;
        e.preventDefault();

        const currentTouchX = e.touches[0].clientX;
        const touchDelta = lastTouchX - currentTouchX;

        targetScrollX += touchDelta * touchSensitivity;

        const currentTime = Date.now();
        const timeDelta = currentTime - lastTouchTime;
        if (timeDelta > 0) {
            touchVelocity = (touchDelta / timeDelta) * 15;
        }

        lastTouchX = currentTouchX;
        lastTouchTime = currentTime;

        const needReset = checkBoundaryAndReset(sequenceWidth);

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(()=> animate(sequenceWidth, needReset));
        }
    });

    container.addEventListener("touchend", () => {
        isDown = false;

        if(Math.abs(touchVelocity) > 0.01) {
            targetScrollX += touchVelocity * 20;

            const decayVelocity = () => {
                touchVelocity += 0.95;

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
    });
});


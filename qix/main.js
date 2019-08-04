/* TODO
 * . collision function for rects and touching a polygon
 *     I can get my greiner-hormann stuff out, probably
 * x when the line crosses itself, destroy it
 *   FIXME janky but works
 * X when the enemy touches the line, game over
 * x bounce the enemy on collision with the level outline
 *   needs to be updated for non-rectangular level
 * . when the line reaches a wall, create a block
 *     I now have splitOutline, which lets me create the two halves
 *     create them, run the collision code to see which one to add
 *     substitute game.level.outline for the new one
 * x join the player back to the outline on collision with it
 *     to join the path again, I need the opposite method, which is going from a point to a distance along the line.
 *     one way to do that is to create a fake polyline that draws from the origin point to the player. I need something
 *     similar for block drawing
 *     the idea is to draw the points one at a time, and ask for each prospective line segment whether the player is on it.
 *     this means either ensuring that the player is right on it, or checking against a hypothetical long thin rectangle,
 *     depending on how thick the rectangle is, this will create a hop, because the last step, where the last corner goes to the player, is bound to diverge
 *     FIXME very janky
 *   
 */

playing = true;

let game = {
    player: {
        position: {
            x: 0,
            y: 0
        },
        previousPosition: {
            x: 0,
            y: 0
        },
        speed: 5,
        lengthTraversed: 0,
        direction: 0, // DIRECTION_RIGHT
        rotationDirection: 'clockwise',
        points: [[0, 5], [5, 0], [10, 5], [5, 10]],
        fill: 'white',
        stroke: 'black',
        shape: undefined,
        drawing: false,
        drawLine: undefined
    },
    enemy: {
        position: {
            x: 100,
            y: 100
        },
        speed: 5,
        direction: Math.PI / 4,
        radius: 10,
        color: 'orange',
        shape: undefined
    },
    level: {
        percentCovered: {
            value: 0,
            shape: undefined
        },
        backgroundColor: 'pink',
        outline: [[0, 0], [700, 0], [700, 500], [0, 500]],
        width: 700,
        height: 500
        // area: 700 * 500,
        // shape: undefined,
        // blocks: [],
    }
}

let originalState = JSON.parse(JSON.stringify(game))

function resetGame(won) {
    if (won) {
        game.level.shape.style.fill = 'green';
    } else {
        game.level.shape.style.fill = 'red';
    }
    requestAnimationFrame(function() {
        sleep(1000);
        game = originalState;
        originalState = JSON.parse(JSON.stringify(game));
        let mainscreen = document.querySelector('#mainscreen');
        while (mainscreen.firstChild) {
            mainscreen.removeChild(mainscreen.firstChild);
        }
        firstDraw();
    });
}

document.addEventListener('keydown', function(event) {
    if (event.repeat) { return; }

    if (event.keyCode === KEYCODE_ESC) {
        playing = playing ? false : true;
    }

    if (game.player.drawing === false) {
        switch (event.keyCode) {
            case KEYCODE_UP:
                if (game.player.rotationDirection === 'clockwise') {
                    game.player.direction += 0.5 * Math.PI;
                } else {
                    game.player.direction -= 0.5 * Math.PI;
                }
                let drawLine = svg('polyline');
                drawLine.classList.add('draw-line');
                drawLine.setAttribute('points', `${game.player.position.x},${game.player.position.y} ${game.player.position.x},${game.player.position.y}`);
                game.player.drawLine = drawLine;
                document.querySelector('#mainscreen').appendChild(drawLine);
                game.player.drawing = true;
                break;
            case KEYCODE_DOWN:
                game.player.rotationDirection = reverseRotationDirection(game.player.rotationDirection);
                break;
        }
    } else {
        // drawing
        let switchedDirection = false;
        switch (event.keyCode) {
            case KEYCODE_DOWN:
                game.player.direction += Math.PI;
                switchedDirection = true;
                break;
            case KEYCODE_LEFT:
                game.player.direction -= 0.5 * Math.PI;
                switchedDirection = true;
                break;
            case KEYCODE_RIGHT:
                game.player.direction += 0.5 * Math.PI;
                switchedDirection = true;
                break;
        }
        if (switchedDirection && game.player.drawLine !== undefined) {
            points = game.player.drawLine.getAttribute('points');
            points += points.slice(points.lastIndexOf(' '));
            game.player.drawLine.setAttribute('points', points);
        }
    }
});

function firstDraw() {
    game.level.totalArea = calcPolygonArea(game.level.outline);
    // draw the level container
    let levelContainer = svg('polygon');
    levelContainer.classList.add('level-container');
    let levelContainerOffset = {
        x: (document.body.clientWidth / 2) - (game.level.width / 2),
        y: (document.body.clientHeight / 2) - (game.level.height / 2)
    };
    levelContainer.setAttribute('points', game.level.outline.map(([x, y]) => [x + levelContainerOffset.x, y + levelContainerOffset.y].join(' ')).join(' '));
    levelContainer.setAttribute('fill', game.level.backgroundColor);
    game.level.shape = levelContainer;

    // draw the percentage cover
    let coverIndicator = svg('text');
    coverIndicator.classList.add('cover-indicator');
    coverIndicator.setAttribute('x', document.body.clientWidth / 2);
    coverIndicator.setAttribute('y', levelContainerOffset.y - 20);
    coverIndicator.setAttribute('text-anchor', 'middle');
    game.level.percentCovered.shape = coverIndicator;

    // draw the player
    let playerShape = svg('polygon');
    playerShape.classList.add('player-shape');
    playerShape.setAttribute('points', game.player.points
        .map((point) => point.join(' ')).join(' '));
    playerShape.setAttribute('stroke', game.player.stroke);
    playerShape.setAttribute('fill', game.player.fill);
    game.player.shape = playerShape;

    // draw the enemy
    let enemyShape = svg('circle');
    enemyShape.classList.add('enemy-shape');
    enemyShape.setAttribute('r', game.enemy.radius);
    enemyShape.setAttribute('cx', game.enemy.position.x + levelContainerOffset.x);
    enemyShape.setAttribute('cy', game.enemy.position.y + levelContainerOffset.y);
    enemyShape.setAttribute('fill', game.enemy.color);
    game.enemy.shape = enemyShape;

    let mainscreen = document.querySelector('#mainscreen');
    mainscreen.appendChild(levelContainer);
    mainscreen.appendChild(coverIndicator);
    mainscreen.appendChild(playerShape);
    mainscreen.appendChild(enemyShape);
}

// update stuff for one frame
function step(timestamp) {
    if (game.level.percentCovered.value > 70) {
        resetGame(true);
    }

    if (playing) {
        let newBlockAdded = true;
        let playerTurned = false;

        // MOVE THINGS
        if (game.player.drawing) {
            game.player.position.x += Math.cos(game.player.direction) * game.player.speed;
            game.player.position.y += Math.sin(game.player.direction) * game.player.speed;
        } else {
            if (game.player.rotationDirection === 'clockwise') {
                game.player.lengthTraversed = mod((game.player.lengthTraversed + game.player.speed), game.level.shape.getTotalLength());
                let newPosition = game.level.shape.getPointAtLength(game.player.lengthTraversed);
                game.player.position.x = newPosition.x;
                game.player.position.y = newPosition.y;
            } else {
                game.player.lengthTraversed = mod((game.player.lengthTraversed - game.player.speed), game.level.shape.getTotalLength());
                let newPosition = game.level.shape.getPointAtLength(game.player.lengthTraversed);
                game.player.position.x = newPosition.x;
                game.player.position.y = newPosition.y;
            }

            if (game.player.lengthTraversed === undefined) {
                console.log('wat');
            }

            // update traveling direction
            game.player.direction = getDirection(game.player.previousPosition, game.player.position);
            // console.log({
            //     [DIRECTION_RIGHT]: 'right',
            //     [DIRECTION_LEFT]: 'left',
            //     [DIRECTION_UP]: 'up',
            //     [DIRECTION_DOWN]: 'down'
            // }[game.player.direction]);
            game.player.previousPosition = Object.assign({}, game.player.position);
        }

        //   move the enemy by speed in direction
        game.enemy.position.x += Math.cos(game.enemy.direction) * game.enemy.speed;
        game.enemy.position.y += Math.sin(game.enemy.direction) * game.enemy.speed;

        // CHECK COLLISIONS
        if (overlaps(game.enemy.shape, game.player.shape)) {
            resetGame(false);
        }
        // bounce the enemy shape when it leaves the play area 
        // FIXME make this work for non-rectangular play area
        if (!containedBy(game.enemy.shape, game.level.shape)) {
            game.enemy.position.x -= 2 * Math.cos(game.enemy.direction) * game.enemy.speed;
            game.enemy.position.y -= 2 * Math.sin(game.enemy.direction) * game.enemy.speed;
            game.enemy.direction -= 0.5 * Math.PI;
        }

        // FIXME
        // put the player back on the outline
        // ensure the polyline is strictly on the outline,
        // this means that its last point should be modified after the player is placed
        if (game.player.drawing) {
            if (game.player.drawLine !== undefined) {
                // console.log('checking line collision for enemy');
                let points = pointsStringToArray(game.player.drawLine.getAttribute('points'));
                let lastSeg = [points[points.length - 2], points[points.length - 1]];
                for (let i = 1; i < points.length; i++) {
                    let a = points[i - 1];
                    let b = points[i];
                    let seg = [a, b];

                    // collision of the drawLine and the enemyShape
                    if (crossesLineSegment(game.enemy.shape, seg)) {
                        resetGame(false);
                    }

                    // collision of the drawLine against itself
                    // FIXME doesn't work consistently
                    if (i < points.length - 1) {
                        if (intersect_lineSegments(seg, lastSeg)) {
                            // console.log('removing drawLine because it self-intersects');
                            game.player.drawLine.remove();
                            game.player.drawLine = undefined;
                            break;
                        }
                    }
                }
            }

            let levelContainerOffset = {
                x: (document.body.clientWidth / 2) - (game.level.width / 2),
                y: (document.body.clientHeight / 2) - (game.level.height / 2)
            };

            // console.log('checking wall collision for player');
            if (!overlaps(game.player.shape, game.level.shape)) {
                console.log('drawing player hit the wall');
                game.player.position.x -= Math.cos(game.player.direction) * game.player.speed;
                game.player.position.y -= Math.sin(game.player.direction) * game.player.speed;
                let playerBCR = game.player.shape.getBoundingClientRect();

                let shiftedBCR = {
                    left: (playerBCR.left - 2 * Math.cos(game.player.direction) * game.player.speed) - levelContainerOffset.x,
                    right: (playerBCR.right - 2 * Math.cos(game.player.direction) * game.player.speed) - levelContainerOffset.x,
                    top: (playerBCR.top - 2 * Math.sin(game.player.direction) * game.player.speed) - levelContainerOffset.y,
                    bottom: (playerBCR.bottom - 2 * Math.sin(game.player.direction) * game.player.speed) - levelContainerOffset.y
                }

                let transformedPlayerRect = [
                    [[shiftedBCR.left, shiftedBCR.top], [shiftedBCR.right, shiftedBCR.top]], 
                    [[shiftedBCR.right, shiftedBCR.top], [shiftedBCR.right, shiftedBCR.bottom]], 
                    [[shiftedBCR.right, shiftedBCR.bottom], [shiftedBCR.left, shiftedBCR.bottom]], 
                    [[shiftedBCR.left, shiftedBCR.bottom], [shiftedBCR.left, shiftedBCR.top]]
                ];

                let debug = svg('polygon');
                debug.classList.add('debug');
                debug.setAttribute('points', transformedPlayerRect.map((a, b) => a.join(',')).join(' '));
                document.querySelector('#mainscreen').appendChild(debug);
                // to think there was once a time when I was impressed with myself for stringing together maps and filters
                // our programming culture is one that glorifies the supposed morally refined cognitive skills needed to perform this kind of mental juggling
                // instead of thinking hey, maybe we should have tools that don't require this kind of bullshit
                // I would love something like Edwards' direct programming, where I could just do the dang thing and tell the system to "do that again, here"

                // check each line segment of the 
                let dist = 0;
                let segs = game.level.outline.concat([game.level.outline[0]]);
                for (let i = 1; i < segs.length; i++) {
                    let a = segs[i - 1];
                    let b = segs[i];
                    let seg = [a, b]

                    // if (crossesLineSegment(transformedPlayerRect, [a, b])) {
                    let crossPoint = crossesLineSegment(debug, seg);
                    if (crossPoint) {
                        if (crossPoint === true) {
                            dist += len(a, [game.player.position.x, game.player.position.y]);
                        } else {
                            dist += len(a, crossPoint);
                        }
                        // console.log('before: ', game.player.lengthTraversed);
                        game.player.lengthTraversed = dist;
                        // console.log('after: ', game.player.lengthTraversed);
                        break;
                    } else {
                        dist += len_rect(a, b);
                    }
                }

                let newPosition = game.level.shape.getPointAtLength(game.player.lengthTraversed);
                game.player.position.x = newPosition.x;
                game.player.position.y = newPosition.y;
                /*
            if (game.player.rotationDirection === 'clockwise') {
                game.player.direction += 0.5 * Math.PI;
            } else {
                game.player.direction -= 0.5 * Math.PI;
            }
            */
                console.log('ending drawing');
                game.player.drawing = false;
                if (game.player.drawLine !== undefined) {
                    let splitLine = game.player.drawLine.getAttribute('points');
                    // console.log('removing drawline because player collided with wall');
                    game.player.drawLine.remove();
                    game.player.drawLine = undefined;

                    splitLine = splitLine.slice(0, splitLine.lastIndexOf(' ')) + ` ${newPosition.x},${newPosition.y}`;
                    splitLine = splitLine
                        .split(' ')
                        .map(s => s.split(',')
                            .map(parseFloat))
                        .map(([x, y]) => [x - levelContainerOffset.x, y - levelContainerOffset.y]);

                            //.map(([x, y]) => [x + levelContainerOffset.x, y + levelContainerOffset.y]));
                    // console.log('SPLITLINE: ', splitLine);
                    let [a, b] = splitOutline(game.level.outline, splitLine);
                    // console.log(a.toString());
                    // console.log(b.toString());
                    let shapeA = svg('polygon');
                    shapeA.classList.add('debug');
                    shapeA.setAttribute('points', a.map(p => p.join(',')).join(' '));
                    let shapeB = svg('polygon');
                    shapeB.classList.add('debug');
                    shapeB.setAttribute('points', b.map(p => p.join(',')).join(' '));
                    document.querySelector('#mainscreen').appendChild(shapeA);
                    if (overlaps(game.enemy.shape, shapeA)) {
                        game.level.outline = a;
                    } else {
                        game.level.outline = b;
                    }
                    shapeA.remove();
                    // console.log('NEW OUTLINE: ', game.level.outline);
                    game.level.shape.setAttribute('points', game.level.outline.map(([x, y]) => [x + levelContainerOffset.x, y + levelContainerOffset.y].join(' ')).join(' '));
                    game.level.currentArea = calcPolygonArea(game.level.outline);
                    game.level.percentCovered.value = Math.ceil(((game.level.totalArea - game.level.currentArea) / game.level.totalArea) * 100);
                }
                // TODO
                // createNewBock(rect, drawLine, exclusionPoint)
                // update percentage cover (compute area of new block, add area of all blocks, compute area of level, take fraction
            }
        } 

        // DRAW THINGS
        let playerTransformString = ''

        playerTransformString += `translate(${game.player.position.x - 5}px, ${game.player.position.y - 5}px) `;

        playerTransformString += `rotate(${game.player.direction}rad) `;

        playerTransformString += 'scale(3, 1)';

        game.player.shape.style.transform = playerTransformString;

        //   assign new enemy position to enemyShape
        let enemyTransformString = ''
        enemyTransformString += `translate(${game.enemy.position.x}px, ${game.enemy.position.y}px) `;
        game.enemy.shape.style.transform = enemyTransformString;

        //   assign new length to drawLine
        if (game.player.drawing && game.player.drawLine !== undefined) {
            let points = game.player.drawLine.getAttribute('points');
            points = points.slice(0, points.lastIndexOf(' ')) + ` ${game.player.position.x},${game.player.position.y}`;
            game.player.drawLine.setAttribute('points', points);
        }

        // update percentage
        game.level.percentCovered.shape.textContent = game.level.percentCovered.value + '%';
    }
    window.requestAnimationFrame(step);
}

firstDraw();
window.requestAnimationFrame(step);

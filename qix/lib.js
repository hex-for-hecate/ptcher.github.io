const KEYCODE_UP = 38;
const KEYCODE_DOWN = 40;
const KEYCODE_LEFT = 37;
const KEYCODE_RIGHT = 39;
const KEYCODE_ESC = 27;
const DIRECTION_RIGHT = 0;
const DIRECTION_LEFT = Math.PI;
const DIRECTION_UP = -Math.PI * 0.5;
const DIRECTION_DOWN = Math.PI * 0.5;

// given a point and a horizontal or vertical line segment, check if the point is on the segment
function pointOnLineSegment([x, y], [[x1, y1], [x2, y2]]) {
    if (x1 === x2 && x1 === x) {
        return (y <= y1 && y >= y2) || (y >= y1 && y <= y2);
    } else if (y1 === y2 && y1 === y) {
        return (x <= x1 && x >= x2) || (x >= x1 && x <= x2);
    }
    return false;
}

// given an outline of a closed polygon and a polyline splitting it, return the two shapes the polygon splits into
function splitOutline(outline, splitline) {
    outline = outline.concat([outline[0]]);
    let ends = [splitline[0], splitline[splitline.length -1]];
    let cuts = {
        first: [],
        second: []
    };
    let phase = 'first';

    for (i = 1; i < outline.length; i++) {
        let a = outline[i - 1];
        let b = outline[i]

        if (pointOnLineSegment(ends[0], [a, b])) {
            if (phase === 'first') {
                cuts.first.push(...splitline);
                for (j = splitline.length - 1; j >= 0; j--) {
                    cuts.second.push(splitline[j]);
                }
                phase = 'second';
            } else {
                phase = 'first';
            }
        } 
        if (pointOnLineSegment(ends[1], [a, b])) {
            if (phase === 'first') {
                for (j = splitline.length - 1; j >= 0; j--) {
                    cuts.first.push(splitline[j]);
                }
                cuts.second.push(...splitline);
                phase = 'second';
            } else {
                phase = 'first';
            }
        }
        cuts[phase].push(b);
    }

    return [cuts.first, cuts.second];
}

function svg(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

function overlaps(shapeA, shapeB) {
    A = shapeA.getBoundingClientRect();
    B = shapeB.getBoundingClientRect();
    return A.bottom > B.top &&
        A.right > B.left &&
        A.left < B.right &&
        A.top < B.bottom;
}

function containedBy(shapeA, shapeB) {
    A = shapeA.getBoundingClientRect();
    B = shapeB.getBoundingClientRect();
    return A.bottom < B.bottom &&
        A.right < B.right &&
        A.left > B.left &&
        A.top > B.top;
}

function reverseRotationDirection(rd) {
    return {
        clockwise: 'counterclockwise',
        counterclockwise: 'clockwise'
    }[rd]
}

function mod(x, cycle) {
    firstAttempt = x % cycle;
    return firstAttempt >= 0 ? firstAttempt : cycle + firstAttempt;
}

/* Check if two polygons intersect */
function collided_polygon_polygon(polygonA, polygonB) {
    // NB: the clipping library expects polygons to be explicitly closed lists of pairs of numbers
    let A = polygonA.concat(polygonA[0]);
    let B = polygonB.concat(polygonB[0]);
    /* Note that the clipping library expects geometry of the form [number, number][][] 
     * The reason is that it works with multipolygons, where rings after the first represent holes 
     */
    let result = GreinerHormann.intersection([A], [B]);
    /* I have no idea why, but sometimes the intersection function rejects with a null, and sometimes it rejects with an empty array 
     * ¯\_(ツ)_/¯
     */
    return result !== null && result.length > 0;
}

function scalar(a, b) {
    return a[0] * b[1] - a[1] * b[0];
}

function vsub(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}

function veq(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}

/**
 * Adapted from Peter Kelley (pgkelley4@gmail.com)
 *
 * Check if two line segments intersect. This uses the 
 * vector cross product approach described below:
 * http://stackoverflow.com/a/565282/786339
 */
function intersect_lineSegments([a1 , a2], [b1, b2]) {
    // let [q1, q2, p1, p2] = Fun.map((p: Point) => (Vector.points2vector({x: 0, y: 0}, p)))([a1, a2, b1, b2]);
	// let r = Vector.sub(p2, p1);
	// let s = Vector.sub(q2, q1);
    let r = vsub(b2, b1);
    let s = vsub(a2, a1);

	let uNumerator = scalar(vsub(a1, b1), r);
        // Vector.scalar(Vector.sub(q1, p1), r);
	let denominator = scalar(r, s);
        // Vector.scalar(r, s);

    // Are the segments collinear?
	if (uNumerator === 0 && denominator === 0) {
		// Do they touch? (Are any of the points equal?)
		if (veq(b1, a1) || veq(b1, a2) || veq(b2, a1) || veq(b2, a2)) {
            //	return true;
            // console.log('shared points, checking direction');
            let diff = Math.abs(getDirection(a1, a2) - getDirection(b1, b2));
            // console.log(diff);
            // console.log(diff === Math.PI);
            return diff === Math.PI;
		}
        /*
		// Do they overlap? (Are all the point differences in either direction the same sign?)
        let xOverlap = new Set([
				(a1.x - b1.x < 0),
				(a1.x - b2.x < 0),
				(a2.x - b1.x < 0),
				(a2.x - b2.x < 0)]).size !== 1;
        let yOverlap = new Set([
                (a1.y - b1.y < 0),
                (a1.y - b2.y < 0),
                (a2.y - b1.y < 0),
                (a2.y - b2.y < 0)]).size !== 1;
        console.log('no shared points, checking if lines overlap');
        return xOverlap || yOverlap;
        */
	}

    console.log('no shared points, trying u-t strategy');

	if (denominator === 0) {
		// lines are parallel
		return false;
	}

	let u = uNumerator / denominator;
    let t = scalar(vsub(a1, b1), s) / denominator;
	// let t = Vector.scalar(Vector.sub(q1, p1), s) / denominator;
    
    // exclude the case where the lines connect at their very ends
    if ((u === 0 && t === 1) || (u === 1 && t === 0)) {
        return false;
    }
    
    if ((t >= 0) && (t <= 1) && (u >= 0) && (u <= 1)) {
        // console.log(`u = ${u}, t = ${t}`);
        // return true;
        console.log(`a1: ${a1}, t: ${t}, r: ${r}`);
        return [a1[0] + t * r[0], a1[1] + t * r[1]];
        // return a1 + t * r
    }

	// return (t >= 0) && (t <= 1) && (u >= 0) && (u <= 1);
}

function getPolyPoints(shape) {
    let bcr = shape.getBoundingClientRect();
    return [[bcr.left, bcr.top], [bcr.right, bcr.top], [bcr.right, bcr.bottom], [bcr.left, bcr.bottom]];
}

// length function for arbitrary points
function len(a, b) {
    return Math.sqrt(Math.pow((b[0] - a[0]), 2) + Math.pow((b[1] - a[1]), 2)); 
}

// length function for rectilinear line segments
function len_rect(a, b) {
    return Math.abs((a[0] - b[0]) + (a[1] - b[1]));
}

function crossesLineSegment(shape, segment) {
    let lineSegs;
    if (isPlainObject(shape)) {
        console.log('crossesLineSegment received transformed shape');
        // assume shape has already been turned into line segs
        lineSegs = shape;
    } else {
        let bcr = shape.getBoundingClientRect();
        lineSegs = [
            [[bcr.left, bcr.top], [bcr.right, bcr.top]], 
            [[bcr.right, bcr.top], [bcr.right, bcr.bottom]], 
            [[bcr.right, bcr.bottom], [bcr.left, bcr.bottom]], 
            [[bcr.left, bcr.bottom], [bcr.left, bcr.top]]
        ];
    }
    for (let lineSeg of lineSegs) {
        // console.log(lineSeg.toString() + ' vs. ' + segment.toString());
        let test = intersect_lineSegments(lineSeg, segment);
        if (test) {
            return test;
        }
        // if (intersect_lineSegments(lineSeg, segment)) {
        //     return true;
        // }
    }
    return false;
}

function pointsStringToArray(s) {
    return s.split(' ').map(p => p.split(','));
}

// returns the direction in radians from point a to point b, assuming the segment is rectilinear
function getDirection(a, b) {
    if (a.x) {
        a = [a.x, a.y];
        b = [b.x, b.y];
    }

    return Math.atan2(b[1] - a[1], b[0] - a[0]);
    /*

    if (b[0] === a[0]) {
        if (b[1] > a[1]) {
            return DIRECTION_DOWN;
        } else {
            return DIRECTION_UP;
        }
    } else if (b[1] === a[1]) {
        if (b[0] > a[0]) {
            return DIRECTION_RIGHT;
        } else {
            return DIRECTION_LEFT
        }
    }
    */
}

function sleep(miliseconds) {
    var currentTime = new Date().getTime();

    while (currentTime + miliseconds >= new Date().getTime()) {
    }
}

function isPlainObject(totest, strict) {
    let string = Object.prototype.toString.call(totest);
    if (string === "[object Array]") {
        return !strict;
    } else if (string !== "[object Object]") {
        return false;
    } 
    // FLUID-5226: This inventive strategy taken from jQuery detects whether the object's prototype is directly Object.prototype by virtue of having an "isPrototypeOf" direct member
    return !totest.constructor || !totest.constructor.prototype || Object.prototype.hasOwnProperty.call(totest.constructor.prototype, "isPrototypeOf");
}
function calcPolygonArea(points) {
    var total = 0;

    for (var i = 0, l = points.length; i < l; i++) {
      var addX = points[i][0];
      var addY = points[i == points.length - 1 ? 0 : i + 1][1];
      var subX = points[i == points.length - 1 ? 0 : i + 1][0];
      var subY = points[i][1];

      total += (addX * addY * 0.5);
      total -= (subX * subY * 0.5);
    }

    return Math.abs(total);
}

// Import modules
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import proj4 from 'proj4';
import '/style.css'; 
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';


// Define the custom projection with its PROJ string
const statePlaneProjString = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";
proj4.defs("EPSG:32118", statePlaneProjString);

// Use this function to convert lon/lat to State Plane coordinates
function toStatePlane(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error(`Invalid coordinates: longitude (${lon}), latitude (${lat})`);
  }
  return proj4("EPSG:32118").forward([lon, lat]);
}

let itemsToLoad = 4; // Update this with the number of assets you are loading
let itemsLoaded = 0;
const spinnerCharacters = ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'];
let currentSpinnerIndex = 0;

// Call this function to update the spinner
function updateSpinner() {
  const progressBar = document.getElementById('progress-bar');
  progressBar.textContent = spinnerCharacters[currentSpinnerIndex];
  currentSpinnerIndex = (currentSpinnerIndex + 1) % spinnerCharacters.length;
}

// Start spinner animation
const spinnerInterval = setInterval(updateSpinner, 100); // Update spinner every 100ms

function updateProgressBar() {
  itemsLoaded++;
  const progress = (itemsLoaded / itemsToLoad) * 100;
  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = `${(progress / itemsToLoad) * 33}%`; // Set width to a third of total progress

  if (itemsLoaded === itemsToLoad) {
    clearInterval(spinnerInterval); // Stop the spinner animation
    progressBar.textContent = "Loading complete!"; // Change the text content
    // All items are loaded, hide the progress bar and show the visualization
    const visualizationContainer = document.getElementById('three-container');
    progressBar.style.display = 'none';
    visualizationContainer.style.visibility = 'visible'; // Reveal the visualization
  }
}


// Three.js - Initialize the Scene
let scene, camera, renderer, controls;
let infoVisible = false;
let isCameraLocked = false;
let globalBoundingBox


function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); // Set Z as up-direction if that's the case for your projection
    camera.position.z = 20; // Adjust as necessary

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('three-container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);

    // Set these after creating the OrbitControls instance
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    // Set the minimum and maximum polar angles (in radians) to prevent the camera from going over the vertical
    controls.minPolarAngle = 0; // 0 radians (0 degrees) - directly above the target
    controls.maxPolarAngle = Math.PI / 2; // π/2 radians (90 degrees) - on the horizon
    
    let ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    let directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);
    renderer.setClearColor(0x000000); // A neutral gray background
    window.addEventListener('resize', onWindowResize, false);
    adjustCameraZoom();
}

// Resize function
function onWindowResize() {
  if (camera && renderer) {
    // Update camera aspect
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Adjust zoom based on window size
    adjustCameraZoom();
  }
}

function adjustCameraZoom() {
  if (camera) {
    // Example of dynamic FOV scaling:
    // - If the window width is 600px or less, use a FOV of 90
    // - If the window width is 1200px or more, use a FOV of 60
    // - Scale linearly between those values for window widths in between
    const minWidth = 600;
    const maxWidth = 1200;
    const minFov = 90;
    const maxFov = 60;

    // Map the window width to the FOV range
    const scale = (window.innerWidth - minWidth) / (maxWidth - minWidth);
    const fov = minFov + (maxFov - minFov) * Math.max(0, Math.min(1, scale));

    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

// Initial call to set up the zoom level
adjustCameraZoom();

// Function to animate your scene
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Ensure DOM is loaded before initializing and starting animation
document.addEventListener('DOMContentLoaded', (event) => {
  initThreeJS();
  animate();
  hideInfoBox();
  lockCameraTopDown(false); // Ensure this is called after controls are initialized
  document.addEventListener('keydown', onDocumentKeyDown, false); // Attach the keydown event handler
});


// Function to hide the information container and show the info button
function hideInfoBox() {
  const infoContainer = document.getElementById('info-container');
  const infoButton = document.getElementById('info-button');
  // Check if the info container is already hidden to prevent unnecessary style changes
  if (infoContainer.style.opacity !== '0') {
    infoContainer.style.opacity = '0'; // Start the fade out
    infoContainer.style.pointerEvents = 'none'; // Make it non-interactive immediately
    infoButton.style.display = 'block'; // Show the info button
    infoVisible = false;
  }
}

// Function to show the information container and hide the info button
function showInfoBox() {
  const infoContainer = document.getElementById('info-container');
  const infoButton = document.getElementById('info-button');
  infoContainer.style.opacity = '1'; // Start the fade in
  infoContainer.style.visibility = 'visible'; // Make it visible immediately
  infoContainer.style.pointerEvents = 'auto'; // Make it interactive again
  infoButton.style.display = 'none'; // Hide the info button
  infoVisible = true;
}

// Add the transitionend event listener
document.getElementById('info-container').addEventListener('transitionend', function(event) {
  if (event.propertyName === 'opacity' && getComputedStyle(this).opacity == 0) {
    this.style.visibility = 'hidden'; // Hide the container after transition
  }
});

// Call this initially if you want the info box to start visible
showInfoBox();

// Set up event listeners for mousedown and keypress events to hide the info box
// Existing event listeners
document.addEventListener('mousedown', (event) => {
  // Check if the target is not the checkbox or its label
  if (event.target.id !== 'camera-lock' && event.target.htmlFor !== 'camera-lock') {
    hideInfoBox();
  }
});

document.addEventListener('keypress', hideInfoBox);

// Event listener for the info button to unhide the info box
document.getElementById('info-button').addEventListener('click', function () {
    showInfoBox();
});


// Define pan speed
const panSpeed = .05;

// Function to handle keyboard events for panning
function onDocumentKeyDown(event) {
  if (isCameraLocked) {
    // Ignore R and F keys when camera is locked
    if (event.key === 'r' || event.key === 'f') {
      return;
    }
  event.preventDefault();

  const rotationSpeed = 0.025; // Speed of rotation
  const vector = new THREE.Vector3(); // Create once and reuse it to avoid garbage collection
  const axis = new THREE.Vector3(1, 0, 0); // X axis for world space rotation

  console.log(`Key pressed: ${event.key}`); // Log which key was pressed


  switch (event.key) {
      // WASD keys for panning
      case 'w':
          camera.position.y += panSpeed;
          controls.target.y += panSpeed;
          break;
      case 's':
          camera.position.y -= panSpeed;
          controls.target.y -= panSpeed;
          break;
      case 'a':
          camera.position.x -= panSpeed;
          controls.target.x -= panSpeed;
          break;
      case 'd':
          camera.position.x += panSpeed;
          controls.target.x += panSpeed;
          break;
      case 'f': // Rotate counter-clockwise
      case 'r': // Rotate clockwise
          const angle = (event.key === 'f' ? 1 : -1) * rotationSpeed;
          vector.copy(camera.position).sub(controls.target);
          const currentPolarAngle = vector.angleTo(new THREE.Vector3(0, 0, 1));
          const newPolarAngle = currentPolarAngle + angle;
      
          // Check if the new angle is within the bounds
          if (newPolarAngle >= 0 && newPolarAngle <= Math.PI / 2) {
              const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
              vector.applyQuaternion(quaternion);
              camera.position.copy(controls.target).add(vector);
              camera.lookAt(controls.target); // Keep the camera looking at the target
          }
          break;
      }
  
      controls.update();
  }}
  
  document.addEventListener('keydown', onDocumentKeyDown, false);
  

// Function to handle panning
function panCamera(dx, dy) {
  camera.position.x += dx * panSpeed;
  camera.position.y += dy * panSpeed;
  controls.target.x += dx * panSpeed;
  controls.target.y += dy * panSpeed;
  controls.update();
}


// Attach click event listeners to the pan buttons
document.getElementById('pan-up').addEventListener('click', () => panCamera(0, 1));
document.getElementById('pan-down').addEventListener('click', () => panCamera(0, -1));
document.getElementById('pan-left').addEventListener('click', () => panCamera(-1, 0));
document.getElementById('pan-right').addEventListener('click', () => panCamera(1, 0));


// Define a scaling factor for the Z values (elevation)
const zScale = 0.0004; // Change this value to scale the elevation up or down

// Function to get color based on elevation
function getColorForElevation(elevation, minElevation, maxElevation) {
  const gradient = [
    { stop: 0, color: new THREE.Color(0x0000ff) }, // blue at the lowest
    { stop: 0.5, color: new THREE.Color(0x00ff00) }, // green at the middle
    { stop: 1, color: new THREE.Color(0xff0000) }  // red at the highest
  ];

  const t = (elevation - minElevation) / (maxElevation - minElevation);

  let lowerStop = gradient[0], upperStop = gradient[gradient.length - 1];
  for (let i = 0; i < gradient.length - 1; i++) {
    if (t >= gradient[i].stop && t <= gradient[i + 1].stop) {
      lowerStop = gradient[i];
      upperStop = gradient[i + 1];
      break;
    }
  }

  const color = lowerStop.color.clone().lerp(upperStop.color, (t - lowerStop.stop) / (upperStop.stop - lowerStop.stop));
  return color;
}

// Define a variable to store the minimum elevation
// This should be determined from the addContourLines function
let globalMinElevation = Infinity;

// Updated addContourLines function to update globalMinElevation
function addContourLines(geojson) {
  // Determine min and max elevation from the geojson
  const elevations = geojson.features.map(f => f.properties.Contour);
  const minElevation = Math.min(...elevations);
  globalMinElevation = Math.min(globalMinElevation, minElevation); // Update the global minimum elevation
  const maxElevation = Math.max(...elevations);

  geojson.features.forEach((feature, index) => {
    const contour = feature.properties.Contour; // Elevation value
    const coordinates = feature.geometry.coordinates; // Array of [lon, lat] pairs

    const color = getColorForElevation(contour, minElevation, maxElevation);
    let material = new THREE.LineBasicMaterial({ color: color });

    // Function to process a single line
    const processLine = (lineCoords, contourValue) => {
      let vertices = [];
      lineCoords.forEach((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2 || pair.some(c => isNaN(c))) {
          console.error(`Feature ${index} has invalid coordinates`, pair);
          return;
        }
        const [lon, lat] = pair;
        try {
          const [x, y] = toStatePlane(lon, lat);
          const z = contourValue * zScale; // Scale the elevation for visibility
          vertices.push(x, y, z);
        } catch (error) {
          console.error(`Feature ${index} error in toStatePlane:`, error.message);
        }
      });

      if (vertices.length > 0) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const line = new THREE.Line(geometry, material);
        scene.add(line);
      }
    };

    // Check geometry type and process accordingly
    if (feature.geometry.type === 'LineString') {
      processLine(coordinates, contour);
    } else if (feature.geometry.type === 'MultiLineString') {
      coordinates.forEach(lineCoords => {
        processLine(lineCoords, contour);
      });
    } else {
      console.error(`Unsupported geometry type: ${feature.geometry.type}`);
    }
  });
}

function addPolygons(geojson, stride = 10) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xFF1493, // Pink color
    transparent: true,
    wireframe: true, // Set wireframe to true for mesh look
    dithering: true,
    opacity: 0.5, // Increase opacity for visibility
    side: THREE.FrontSide // Render both sides of the polygon
  });

  for (let i = 0; i < geojson.features.length; i += stride) {
    const feature = geojson.features[i];
    try {
      const shapeCoords = feature.geometry.coordinates[0]; // Assuming no holes in the polygon for simplicity
      const vertices = [];
      let centroid = new THREE.Vector3(0, 0, 0);

      // Convert coordinates to vertices and calculate centroid
      shapeCoords.forEach(coord => {
        const [x, y] = toStatePlane(coord[0], coord[1]);
        const z = globalMinElevation * zScale; // Set Z to the lowest contour elevation
        vertices.push(new THREE.Vector3(x, y, z));
        centroid.add(new THREE.Vector3(x, y, z));
      });

      centroid.divideScalar(shapeCoords.length); // Average to find centroid
      vertices.unshift(centroid); // Add centroid as the first vertex

      const shapeGeometry = new THREE.BufferGeometry();
      const positions = [];

      // The centroid is the first vertex, and it's connected to every other vertex
      for (let j = 1; j <= shapeCoords.length; j++) {
        // Add centroid
        positions.push(centroid.x, centroid.y, centroid.z);

        // Add current vertex
        positions.push(vertices[j % shapeCoords.length].x, vertices[j % shapeCoords.length].y, vertices[j % shapeCoords.length].z);

        // Add next vertex
        positions.push(vertices[(j + 1) % shapeCoords.length].x, vertices[(j + 1) % shapeCoords.length].y, vertices[(j + 1) % shapeCoords.length].z);
      }

      shapeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      shapeGeometry.computeVertexNormals();

      const mesh = new THREE.Mesh(shapeGeometry, material);
      scene.add(mesh);
    } catch (error) {
      console.error(`Error processing feature at index ${i}:`, error);
    }
  }
}

// Attach the modified keydown event handler
document.removeEventListener('keydown', onDocumentKeyDown); // Remove the old handler if it was added before
document.addEventListener('keydown', onDocumentKeyDown, false);

function addGraticule(scene, boundingBox, gridSize, scaleFactor) {
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00, // bright green
      opacity: 0.2,
      transparent: true
    });
    const gridGroup = new THREE.Group();

  // Calculate center of bounding box
  const centerX = (boundingBox.min.x + boundingBox.max.x) / 2;
  const centerY = (boundingBox.min.y + boundingBox.max.y) / 2;

  // Calculate scaled bounding box
  let scaledMinX = centerX + (boundingBox.min.x - centerX) * scaleFactor;
  let scaledMaxX = centerX + (boundingBox.max.x - centerX) * scaleFactor;
  let scaledMinY = centerY + (boundingBox.min.y - centerY) * scaleFactor;
  let scaledMaxY = centerY + (boundingBox.max.y - centerY) * scaleFactor;

  // Adjust the scaled bounds to align with the grid size
  scaledMinX = Math.ceil(scaledMinX / gridSize) * gridSize;
  scaledMaxX = Math.floor(scaledMaxX / gridSize) * gridSize;
  scaledMinY = Math.ceil(scaledMinY / gridSize) * gridSize;
  scaledMaxY = Math.floor(scaledMaxY / gridSize) * gridSize;

  // Ensure the adjusted scaled bounds do not exceed the original bounding box limits
  scaledMinX = Math.max(scaledMinX, boundingBox.min.x);
  scaledMaxX = Math.min(scaledMaxX, boundingBox.max.x);
  scaledMinY = Math.max(scaledMinY, boundingBox.min.y);
  scaledMaxY = Math.min(scaledMaxY, boundingBox.max.y);

  // Create graticule lines within the adjusted scaled bounding box
  for (let x = scaledMinX; x <= scaledMaxX; x += gridSize) {
    const vertices = [
      new THREE.Vector3(x, scaledMinY, 0),
      new THREE.Vector3(x, scaledMaxY, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const line = new THREE.Line(geometry, material);
    gridGroup.add(line);
  }

  for (let y = scaledMinY; y <= scaledMaxY; y += gridSize) {
    const vertices = [
      new THREE.Vector3(scaledMinX, y, 0),
      new THREE.Vector3(scaledMaxX, y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const line = new THREE.Line(geometry, material);
    gridGroup.add(line);
  }

  // Create the outline of the graticule
  const outlineVertices = [
    new THREE.Vector3(scaledMinX, scaledMinY, 0), // Bottom Left
    new THREE.Vector3(scaledMaxX, scaledMinY, 0), // Bottom Right
    new THREE.Vector3(scaledMaxX, scaledMaxY, 0), // Top Right
    new THREE.Vector3(scaledMinX, scaledMaxY, 0), // Top Left
    new THREE.Vector3(scaledMinX, scaledMinY, 0)  // Back to Bottom Left to close the outline
  ];
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlineVertices);
  const outline = new THREE.LineLoop(outlineGeometry, material); // Use LineLoop to close the outline
  gridGroup.add(outline);

  scene.add(gridGroup);
}


function createTextLabel(text, fontsize = '4pt', fontface = 'monospace') {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Set font size and face
  context.font = `${fontsize} ${fontface}`;

  // Get text dimensions
  const metrics = context.measureText(text.toUpperCase());
  const textWidth = metrics.width;
  canvas.width = textWidth;
  canvas.height = parseInt(fontsize, 10); // Convert pt to px

  // Set style for the background
  context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Black background with 50% opacity
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Set style for the text
  context.font = `${fontsize} ${fontface}`;
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

  // Create texture from the canvas
  const texture = new THREE.CanvasTexture(canvas);

  // Create sprite material with this texture
  const material = new THREE.SpriteMaterial({ map: texture });

  // Create and return the sprite
  const sprite = new THREE.Sprite(material);
  return sprite;
}

// function updateLabels(camera, objects, maxLabelDistance) {
//   // Update the camera frustum
//   camera.updateMatrix(); // make sure the camera matrix is updated
//   camera.updateMatrixWorld(); // make sure the camera's world matrix is updated
//   const frustum = new THREE.Frustum();
//   frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

//   // Calculate the current scale based on camera zoom or position
//   const currentScale = calculateScaleBasedOnCamera(camera);

//   // Iterate through the objects
//   objects.forEach(object => {
//     const distance = camera.position.distanceTo(object.position);

//     // Check if the object is within the maximum label distance and the frustum
//     if (distance < maxLabelDistance && frustum.containsPoint(object.position)) {
//       // Scale the label size based on distance and/or camera scale
//       const labelScale = calculateLabelScale(distance, currentScale);
//       createOrUpdateLabelForObject(object, labelScale);
//     } else {
//       // Hide or remove the label for the object
//       hideOrRemoveLabelForObject(object);
//     }
//   });
// }


function addFMTowerPts(geojson) {
  // Define the base size and height for the pyramids
  const baseSize = 0.003; // This would be the size of one side of the pyramid's base
  const pyramidHeight = .015; // This would be the height of the pyramid from the base to the tip

  // Material for the wireframe pyramids
  const pyramidMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFFF00, // yellow color
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });

  // Parse the POINT data from the GeoJSON
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates;
      const elevation = feature.properties.Elevation;
      
      try {
        // Convert the lon/lat to State Plane coordinates
        const [x, y] = toStatePlane(lon, lat);
        const z = elevation * zScale; // Apply the scaling factor to the elevation

        // Create a cone geometry for the pyramid with the defined base size and height
        // The number of radial segments is set to 4 for a square base
        const pyramidGeometry = new THREE.ConeGeometry(baseSize, pyramidHeight, 5);

        // Rotate the pyramid to point up along the Z-axis
        pyramidGeometry.rotateX(Math.PI / 2);

        const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
        pyramid.position.set(x, y, z);
        scene.add(pyramid);
      } catch (error) {
        console.error(`Error projecting point:`, error.message);
      }
    } else {
      console.error(`Unsupported geometry type for points: ${feature.geometry.type}`);
    }
  });
}


// Function to add wireframe pyramids for POINT data from GeoJSON
function addCellTowerPts(geojson) {
  // Define the base size and height for the pyramids
  const baseSize = 0.003; // This would be the size of one side of the pyramid's base
  const pyramidHeight = .015; // This would be the height of the pyramid from the base to the tip

  // Material for the wireframe pyramids
  const pyramidMaterial = new THREE.MeshBasicMaterial({
    color: 0xFA3000, // Red color
    wireframe: false,
    transparent: true,
    opacity: 0.4
  });

  // Parse the POINT data from the GeoJSON
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates;
      const elevation = feature.properties.Elevation;
      
      try {
        // Convert the lon/lat to State Plane coordinates
        const [x, y] = toStatePlane(lon, lat);
        const z = elevation * zScale; // Apply the scaling factor to the elevation

        // Create a cone geometry for the pyramid with the defined base size and height
        // The number of radial segments is set to 4 for a square base
        const pyramidGeometry = new THREE.ConeGeometry(baseSize, pyramidHeight, 5);

        // Rotate the pyramid to point up along the Z-axis
        pyramidGeometry.rotateX(Math.PI / 2);

        const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
        pyramid.position.set(x, y, z);
        scene.add(pyramid);

        // const label = createTextLabel(`${feature.properties.Callsign} ${feature.properties.LocCity}`);
        // label.position.set(x, y, z + pyramidHeight + 0.0015); // Position above the pyramid
        // scene.add(label);

      } catch (error) {
        console.error(`Error projecting point:`, error.message);
      }
    } else {
      console.error(`Unsupported geometry type for points: ${feature.geometry.type}`);
    }
  });
}


function getBoundingBoxOfGeoJSON(geojson) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Function to process each coordinate pair
  const processCoordinates = (coords) => {
    coords.forEach(coord => {
      // If it's a MultiLineString, coord will be an array of coordinate pairs
      if (Array.isArray(coord[0])) {
        processCoordinates(coord); // Recursive call for arrays of coordinates
      } else {
        // Assuming coord is [longitude, latitude]
        const [lon, lat] = coord;

        // Transform the coordinates
        const [x, y] = toStatePlane(lon, lat);

        // Update the min and max values
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    });
  };

  // Iterate over each feature
  geojson.features.forEach(feature => {
    processCoordinates(feature.geometry.coordinates);
  });

  // Return bounding box with min and max as THREE.Vector3 objects
  return {
    min: new THREE.Vector3(minX - 2, minY - 2, -Infinity),
    max: new THREE.Vector3(maxX + 2, maxY + 2, Infinity)
  };
}


function constrainCamera(controls, boundingBox) {
  controls.addEventListener('change', () => {
    // Clamp the camera position within the bounding box
    camera.position.x = Math.max(boundingBox.min.x, Math.min(boundingBox.max.x, camera.position.x));
    camera.position.y = Math.max(boundingBox.min.y + 0.25, Math.min(boundingBox.max.y, camera.position.y));
    camera.position.z = Math.max(boundingBox.min.z, Math.min(boundingBox.max.z, camera.position.z));
    
    // Clamp the controls target within the bounding box
    controls.target.x = Math.max(boundingBox.min.x, Math.min(boundingBox.max.x, controls.target.x));
    controls.target.y = Math.max(boundingBox.min.y, Math.min(boundingBox.max.y, controls.target.y));
    controls.target.z = Math.max(boundingBox.min.z, Math.min(boundingBox.max.z, controls.target.z));

  });
}


// Function to get the center of the bounding box
// This function is correct but make sure it's called after the lines are added to the scene
function getCenterOfBoundingBox(boundingBox) {
  return new THREE.Vector3(
    (boundingBox.min.x + boundingBox.max.x) / 2,
    (boundingBox.min.y + boundingBox.max.y) / 2,
    0 // Assuming Z is not important for centering in this case
  );
}

// Ensure that you get the size correctly
function getSizeOfBoundingBox(boundingBox) {
  return new THREE.Vector3(
    boundingBox.max.x - boundingBox.min.x,
    boundingBox.max.y - boundingBox.min.y,
    boundingBox.max.z - boundingBox.min.z
  );
}

// Adjust the camera to view the entire extent of the GeoJSON features
// function adjustCameraToBoundingBox(camera, controls, boundingBox) {
//   const center = getCenterOfBoundingBox(boundingBox);
//   const size = getSizeOfBoundingBox(boundingBox);
//   const maxDim = Math.max(size.x, size.y);
//   const fov = camera.fov * (Math.PI / 180);
//   let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)); // Adjust the 2 to frame the scene

//   cameraZ *= 1.1; // Slight adjustment to ensure the features are fully visible
//   camera.position.set(center.x, center.y, cameraZ);
//   controls.target.set(center.x, center.y, 0);
//   controls.update();
// }

// Function to lock the camera to a top-down view
// Function to calculate the camera Z position to view the entire bounding box
function calculateCameraZToFitBoundingBox(boundingBox) {
  const center = getCenterOfBoundingBox(boundingBox);
  const size = getSizeOfBoundingBox(boundingBox);
  const maxDim = Math.max(size.x, size.y);
  const fov = camera.fov * (Math.PI / 100);
  
  // Calculate the Z position where the entire bounding box is in view
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.1; // Scale factor to ensure everything is within view, adjust as needed
  return cameraZ;
}

function lockCameraTopDown(isLocked) {
  isCameraLocked = isLocked;
  if (!controls) return; // Ensure controls are initialized

  if (isLocked) {
    if (!globalBoundingBox) {
      console.error('globalBoundingBox is not set');
      return;
    }
    const center = getCenterOfBoundingBox(globalBoundingBox);
    const cameraZ = calculateCameraZToFitBoundingBox(globalBoundingBox);
    // Assuming the north is along the negative Y-axis in your projection
    const northDirection = new THREE.Vector3(0, -1, 0);

    // Position the camera at the center of the bounding box at the appropriate Z height
    camera.position.set(center.x, center.y, cameraZ);

    // Look down at the center of the bounding box
    camera.lookAt(center.x, center.y, 0);

    // Orient the camera to face north
    camera.up.set(0, 0, 1); // Z is up in three.js by default
    camera.lookAt(center.clone().add(northDirection));

    // Set the rotation to look straight down to the ground
    camera.rotation.x = 0;
    camera.rotation.y = 0;
    camera.rotation.z = 0;

    controls.enableRotate = false; // Disable rotation
    controls.enablePan = true; // Enable panning
    // Change both left and right mouse buttons to pan
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    
  } else {
    // Restore previous behavior
    controls.enableRotate = true;
    controls.enablePan = true;
    // Restore default mouse button actions
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
  }
  controls.update();
}



// Call this function initially to set up the default state
lockCameraTopDown(false);


// Update the checkbox event listener to pass the boundingBox
// In your event listeners
document.getElementById('camera-lock').addEventListener('change', (event) => {
  lockCameraTopDown(event.target.checked);
});


// Add this event listener to stop the propagation of the click event
document.getElementById('camera-lock').addEventListener('click', (event) => {
  event.stopPropagation(); // This will prevent the click from reaching the document level
});


// Set material for the contour lines
const lineMaterial = new THREE.LineBasicMaterial({
  color: 0xff0000, // Bright red
  linewidth: 4 // Make sure the lines are thick enough to be visible
});


// Fetching the contour lines GeoJSON and adding to the scene
fetch('data/cont49l010a_Clip_SimplifyLin_simplified.geojson')
  .then(response => response.json())
  .then(geojson => {
    addContourLines(geojson); // Existing call to add contour lines
    updateProgressBar();


    // Fetch and add POINT data here after adding contour lines
    fetch('data/Cellular_Tower_HIFLD_NYSclip_20231101_simplified.geojson')
      .then(response => response.json())
      .then(pointGeojson => {
        addCellTowerPts(pointGeojson); // Call the new function to add points
        console.log("adding points")
        updateProgressBar();
      })
      .catch(error => {
        console.error('Error loading points GeoJSON:', error);
      });

    // Fetch and add the polygon data
    fetch('data/FM_contours_NYS_clip_20231101.geojson')
    .then(response => response.json())
    .then(polygonGeojson => {
      addPolygons(polygonGeojson);
      console.log("Polygons added");
      updateProgressBar();
    })
    .catch(error => {
      console.error('Error loading polygon GeoJSON:', error);
    });

    // Fetch and add the points data
    fetch('data/FM_TransTowers_PairwiseClip_NYS_20231101_simplified.geojson')
    .then(response => response.json())
    .then(pointGeojson => {
      addFMTowerPts(pointGeojson);
      console.log("Yellow points added");
      updateProgressBar();
    })
    .catch(error => {
      console.error('Error loading points GeoJSON:', error);
    });


    const boundingBox = getBoundingBoxOfGeoJSON(geojson);
    const gridSize = 0.1; // This represents your grid cell size
    const scaleFactor = 0.5; // This is the scale factor by which you want to shrink the graticule

    addGraticule(scene, boundingBox, gridSize, scaleFactor);

    globalBoundingBox = getBoundingBoxOfGeoJSON(geojson);
    
        
    // Move the camera and set controls target
    const center = getCenterOfBoundingBox(boundingBox);
    const size = getSizeOfBoundingBox(boundingBox);
    const maxDim = Math.max(size.x, size.y);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 0.7; // adjust Z magic number
    const initialCameraZ = calculateCameraZToFitBoundingBox(globalBoundingBox);
    camera.position.set(center.x, center.y, initialCameraZ);
    controls.target.set(center.x, center.y, 0);

    // Now, add the constraints to the camera and controls
    constrainCamera(controls, boundingBox);

    // Call this after setting the position and target
    controls.update();
  })
  .catch(error => {
    console.error('Error loading GeoJSON:', error);
  });



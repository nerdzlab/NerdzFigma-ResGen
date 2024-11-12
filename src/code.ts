///
/// Figma.core related.
///

/// Handle the plugin commands from figma app.
figma.on('run', async ({ command }) => {
  if (command === 'extract-text') {
    const framesData = extractTextFromFrames();
    if (framesData.length === 0) {
      figma.notify("Please select at least one frame with text nodes.");
      figma.closePlugin();
      return;
    }

    figma.showUI(__uiFiles__.arb, { width: 600, height: 600 });

    figma.ui.postMessage({ type: 'preview-text', data: framesData });
  } else if (command === 'extract-text-styles') {
    const stylesData = extractTextStylesFromSelection();

    if (stylesData.length === 0) {
      figma.notify("Please select anything with text.");
      figma.closePlugin();
      return;
    }

    figma.showUI(__uiFiles__.textStyles, { width: 800, height: 600 });

    figma.ui.postMessage({ type: 'preview-text-styles', data: stylesData });
  }
  else if (command === 'extract-colors') {
    const colorsData = extractColorsFromSelection();
    if (colorsData.length === 0) {
      figma.notify("Please select anything with colors.");
      figma.closePlugin();
      return;
    }

    figma.showUI(__uiFiles__.colors, { width: 600, height: 600 });

    figma.ui.postMessage({ type: 'load-colors', data: colorsData });
  }
});

/// Handel any messages in plugin.
/// Send via html.
figma.ui.onmessage = (msg) => {
  if (msg.type === 'zoom-via-id') {
    console.log(msg.nodeId)
    const nodeId = msg.nodeId;
    zoomToElementById(nodeId);
  }
}

///
/// Extract TextStyles feature.
///

// Define type scale mapping from Material Design 3 in descending order with camelCase names
const typeScales: { fontSize: number, name: string }[] = [
  { fontSize: 96, name: 'displayLarge' },
  { fontSize: 84, name: 'displayMedium' },
  { fontSize: 72, name: 'displaySmall' },
  { fontSize: 60, name: 'headlineLarge' },
  { fontSize: 48, name: 'headlineMedium' },
  { fontSize: 40, name: 'headlineSmall' },
  { fontSize: 32, name: 'titleLarge' },
  { fontSize: 28, name: 'titleMedium' },
  { fontSize: 24, name: 'titleSmall' },
  { fontSize: 20, name: 'labelLarge' },
  { fontSize: 16, name: 'labelMedium' },
  { fontSize: 14, name: 'labelSmall' },
  { fontSize: 12, name: 'bodyLarge' },
  { fontSize: 10, name: 'bodyMedium' },
  { fontSize: 8, name: 'bodySmall' }
];

// Function to get the type scale name based on font size
function getTypeScaleName(fontSize: number): string {
  const scale = typeScales.find((scale) => fontSize >= scale.fontSize);
  return scale ? scale.name : 'unknown';
}

const extractTextStylesFromSelection = () => {
  const textStyles: any[] = [];

  for (const node of figma.currentPage.selection) {
    if (node.type === 'FRAME') {
      const textNodes = node.findAll(n => n.type === 'TEXT') as TextNode[];

      textNodes.forEach(textNode => {
        const fontFamily = (textNode.fontName as FontName).family;
        const fontSize = textNode.fontSize as number;
        const fontWeight = textNode.fontWeight as number;
        const baseFontName = getTypeScaleName(fontSize);
        const fontName = `${baseFontName}${(textNode.fontName as FontName).style}`;

        const newTextStyle = {
          fontName: fontName,
          fontFamily: fontFamily.toLowerCase(),
          fontSize: fontSize.toFixed(2),
          fontWeight: fontWeight,
        };

        // Check if a similar style already exists
        const isDuplicate = textStyles.some(style =>
          style.fontName === newTextStyle.fontName &&
          style.fontFamily === newTextStyle.fontFamily &&
          style.fontSize === newTextStyle.fontSize &&
          style.fontWeight === newTextStyle.fontWeight
        );

        // Only add if not duplicate
        if (!isDuplicate) {
          textStyles.push(newTextStyle);
        }
      });
    }
  }

  // Append font size to names with duplicates
  const nameCounts: { [key: string]: number } = {};
  textStyles.forEach(style => {
    const baseName = style.fontName;
    nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
  });

  // If any names are duplicated, append the font size to make them unique
  textStyles.forEach(style => {
    if (nameCounts[style.fontName] > 1) {
      style.fontName = `${style.fontName}${Math.round(style.fontSize)}`;
    }
  });

  return textStyles;
};


///
/// Extract colors feature.
///
const extractColorsFromSelection = (): { hex: string, name: string }[] => {

  const colors = figma.getSelectionColors()
  const seenColors = new Set();

  const exportColors = colors?.paints.map(paint => {
    if (paint.type === "SOLID") {
      const hex = colorRGBToString(paint.color);

      if (seenColors.has(hex)) {
        return null;
      }

      seenColors.add(hex);
      return { hex: hex, name: hex };
    }

    return null
  }).filter((item): item is
    { hex: string, name: string } => item !== null);

  return exportColors || [];
};

const colorRGBToString = (color: RGB) => "#" +
  Math.round(color.r * 255).toString(16).padStart(2, "0") +
  Math.round(color.g * 255).toString(16).padStart(2, "0") +
  Math.round(color.b * 255).toString(16).padStart(2, "0");

///
/// Extract ARB feature.
///

/// Function to extract text from frames with camel case keys
/// Repeats - ignoring.
const extractTextFromFrames = (): { id: string, name: string, nameCamelCase: string, textNodes: { key: string, content: string }[] }[] => {
  const framesData = [];
  const seenContent = new Set();
  const maxKeyLength = 20;

  for (const node of figma.currentPage.selection) {
    if (node.type === 'FRAME') {
      const frameNameCamelCase = toCamelCaseWithLimit(node.name, maxKeyLength);
      const textNodes = node.findAll(n => n.type === 'TEXT') as TextNode[];
      const frameTextNodes = textNodes
        .map(textNode => {
          const keyCamelCase = toCamelCaseWithLimit(textNode.characters, maxKeyLength);
          const key = `${frameNameCamelCase}${keyCamelCase.charAt(0).toUpperCase() + keyCamelCase.slice(1)}`;
          const content = textNode.characters;

          if (seenContent.has(content)) {
            return null;
          }

          seenContent.add(content);
          return { key, content };
        }).filter((item): item is
          { key: string, content: string } => item !== null);

      framesData.push({
        id: node.id,
        name: node.name,
        nameCamelCase: frameNameCamelCase,
        textNodes: frameTextNodes,
      });
    }
  }

  return framesData;
};

/// Helper function to convert text to camel case and limit its length.
/// Limited not by characters but by words. 
/// NOT loginScreenSomeLongTextUnder... -> BUT(ends on word) loginScreenSomeLongText
const toCamelCaseWithLimit = (text: string, maxLength: number): string => {
  const words = text
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean);

  let camelCaseKey = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');

  if (camelCaseKey.length > maxLength) {
    let trimmedKey = '';
    for (const word of words) {
      const potentialKey = trimmedKey + (trimmedKey ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase());
      if (potentialKey.length > maxLength) break;
      trimmedKey = potentialKey;
    }
    return trimmedKey;
  }

  return camelCaseKey;
};


///
/// Interactions with figma.
///

/// Zooming to element via id.
const zoomToElementById = async (nodeId: string) => {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);

    if (node) {
      figma.viewport.scrollAndZoomIntoView([node]);
    } else {
      figma.notify(`Node with ID ${nodeId} not found.`, { error: true });
    }
  } catch (error) {
    figma.notify(`Error retrieving node with ID ${nodeId}: ${error}`, { error: true });
  }
};
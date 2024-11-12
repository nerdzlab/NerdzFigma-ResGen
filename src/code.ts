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
  } else if (command === 'extract-text-styles') { }
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
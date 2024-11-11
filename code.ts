/// Handle the plugin commands from figma app.
figma.on('run', async ({ command }) => {
  if (command === 'extract-text') {
    const framesData = extractTextFromFrames();
    if (framesData.length === 0) {
      figma.notify("Please select at least one frame with text nodes.");
      figma.closePlugin();
      return;
    }

    figma.showUI(__html__, { width: 600, height: 600 });

    figma.ui.postMessage({ type: 'preview-text', data: framesData });
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
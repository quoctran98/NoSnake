![](https://github.com/quoctran98/NoSnake/blob/master/logo.png)

# About

NoSnake is a browser extension for [Google Chrome](https://www.google.com/chrome/) to block images of snakes. NoSnake recognizes images primarily using a computer vision AI from [Clarifai](https://www.clarifai.com).

# Installation

NoSnake isn't currently on the Chrome Web Store, but it can be installed as an unpacked extension on the Google Chrome browser. In order to take advantage of Clarifai's computer vision AI an API key is needed as well.

#### Getting a Clarifai API key
1. Create an account at https://www.clarifai.com
2. Create an application using the button at the top right of the page
3. Select the newly created application and the API key should be listed on the page
4. Copy this key `NoSnake/client/NoSnake/client_config.json` under the `clarifaiKey` field

#### Loading the Chrome extension

1. Navigate to the extension management page in the Google Chrome browser at `chrome://extensions/`
2. Enable developer mode using the button in the top right corner
3. Click `Load unpacked` and select the entire folder at `NoSnake/client/NoSnake`
4. The extension can now be enabled or disabled using the button on the extension management page

# Usage

NoSnake will now be able to automatically detect and replace images of snakes with the NoSnake logo. Clarifai's free plan allows for up to 5000 images per month. After this is exceeded, NoSnake will stop being able to recognize images of snakes with computer vision. However, NoSnake will still be able to detect key words in an image's alt text and will cache previously recognized images.

[NoSnake in action](https://imgur.com/a1ecVS7)

# Plans

In its current state, NoSnake is an extremely barebones program. A better user interface allowing more control over where and how NoSnake blocks images is in the works. NoSnake is also continually being optimized for faster and more robust blocking of snake images.

There are also plans to move away from Clarifai's API as well as to create a crowdsourced database of snake images to better and more quickly block images of snakes.

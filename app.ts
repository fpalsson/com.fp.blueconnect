import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import Homey from 'homey';

class BlueConnectApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit(): Promise<void> {
    this.log('BlueConnectApp has been initialized');
  }
}

module.exports = BlueConnectApp;
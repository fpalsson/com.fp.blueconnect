import { Device } from 'homey';
// @ts-ignore
import { BlueriiotAPI} from 'blueriiot-api-client';

class BlueConnectDevice extends Device {
  private api:any;
  private apiInited:boolean=false;
  private username:string='';
  private password:string='';
  private poolId:string='';
  private blueId:string='';
  private runningtimer!:NodeJS.Timeout;

  private lastTempMeasurement:number=0;
  private lastPhMeasurement:number=0;
  private lastOrpMeasurement:number=0;
  private lastConductivityMeasurement:number=0;
  private lastMeasurementTimestamp:Date = new Date(0);

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.addCapability('measure_ph');
    await this.addCapability('measure_orp');
    await this.addCapability('measure_conductivity');

    let data:any = this.getData();
    console.log(data.id);

    this.poolId = data.id;

    this.username = await this.getSetting('username');
    this.password = await this.getSetting('password');

    await this.initAPI();
    if (this.apiInited) {
        this.startTimer();
    }
    
    this.log('BlueConnectDevice has been initialized');
    
  }



  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('BlueConnectDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings: {}, newSettings: {}, changedKeys: {} }): Promise<string|void> {
    this.log('BlueConnectDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('BlueConnectDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('BlueConnectDevice has been deleted');
  }


  async refreshMeasurements() {
    try {
      //console.log('Starting refresh with poolId: ' + this.poolId + ' blueId: ' + this.blueId);
      let measurementsStringData = await this.api.getLastMeasurements(this.poolId, this.blueId)
      let measurementsData = JSON.parse(measurementsStringData);
  
      let measurementTimestamp = new Date(Date.parse(measurementsData.last_blue_measure_timestamp));
      if (measurementTimestamp > this.lastMeasurementTimestamp) {
          this.lastMeasurementTimestamp = measurementTimestamp

          measurementsData.data.forEach((measurement:any) => {
  
              switch(measurement.name) { 
                  case 'temperature': { 
                      //if (this.lastTempMeasurement != measurement.value){
                          this.setCapabilityValue('measure_temperature', measurement.value);      
                      //    this.lastTempMeasurement = measurement.value;
                          console.log('New temperature measurement. Now: ' + measurement.value);
                      //}
                  break; 
                  } 
                  case 'ph': { 
                    measurement.value = Math.round(measurement.value*10)/10;
                    //if (this.lastPhMeasurement != measurement.value){
                        this.setCapabilityValue('measure_ph', measurement.value);      
                    //    this.lastPhMeasurement = measurement.value;
                        console.log('New pH measurement. Now: ' + measurement.value);
                    //}
                  break; 
                  } 
                  case 'orp': { 
                    measurement.value = Math.round(measurement.value);
                    //if (this.lastOrpMeasurement != measurement.value){
                        this.setCapabilityValue('measure_orp', measurement.value);      
                    //    this.lastOrpMeasurement = measurement.value;
                        console.log('New ORP measurement. Now: ' + measurement.value);
                    //}
                  break; 
                  } 
                  case 'conductivity': { 
                    measurement.value = Math.round(measurement.value);
                    //if (this.lastConductivityMeasurement != measurement.value){
                        this.setCapabilityValue('measure_conductivity', measurement.value);      
                    //    this.lastConductivityMeasurement = measurement.value;
                        console.log('New conductivity measurement. Now: ' + measurement.value);
                    //}
                  break; 
                  } 
                  default: { 
                        //statements; 
                        break; 
                  } 
              } 
          });
     
      }
      else {

      }

        
    } catch (error) {
      console.log('Error in refreshMeasurements: ' + error);      
    }
    

  /*  {
      "status": "OK",
      "last_blue_measure_timestamp": "2021-06-07T09:35:00.000Z",
      "blue_device_serial": "",
      "swimming_pool_id": "",
      "data": [
        {
          "name": "temperature",
          "priority": 10,
          "timestamp": "2021-06-07T09:35:00.000Z",
          "expired": false,
          "value": 28.3,
          "trend": "stable",
          "ok_min": 20,
          "ok_max": 40,
          "warning_high": 50,
          "warning_low": 5,
          "gauge_max": 50,
          "gauge_min": 0,
          "issuer": "gateway"
        },
        {
          "name": "ph",
          "priority": 20,
          "timestamp": "2021-06-07T09:35:00.000Z",
          "expired": false,
          "value": 7.6,
          "trend": "stable",
          "ok_min": 7.2,
          "ok_max": 7.6,
          "warning_high": 8.4,
          "warning_low": 6.6,
          "gauge_max": 10,
          "gauge_min": 5,
          "issuer": "gateway"
        },
        {
          "name": "orp",
          "priority": 30,
          "timestamp": "2021-06-07T09:35:00.000Z",
          "expired": false,
          "value": 661,
          "trend": "stable",
          "ok_min": 650,
          "ok_max": 750,
          "warning_high": 900,
          "warning_low": 400,
          "gauge_max": 1000,
          "gauge_min": 300,
          "issuer": "gateway"
        },
        {
          "name": "conductivity",
          "priority": 40,
          "timestamp": "2021-06-07T09:35:00.000Z",
          "expired": false,
          "value": 1199,
          "trend": "increase",
          "ok_min": 300,
          "ok_max": 10000,
          "warning_high": 12000,
          "warning_low": 200,
          "gauge_max": 20000,
          "gauge_min": 0,
          "issuer": "gateway"
        }
      ]
    }
    */

  }

  async initAPI() {
    try {
      console.log('About to log in with user: ' + this.username + ' and pass: *****');
      this.api = new BlueriiotAPI(this.username, this.password);
      await this.api.init();
      if (this.api.isAuthenticated()) {
          let blueDeviceStringData = await this.api.getSwimmingPoolBlueDevices(this.poolId);
          console.log(blueDeviceStringData);

          let blueDeviceData = JSON.parse(blueDeviceStringData);
          
          //data[].blue_device_serial
          if (blueDeviceData.data.length > 0){
              this.blueId = blueDeviceData.data[0].blue_device_serial;
              console.log('Blue Riiot API inited succesfully');
              console.log('PoolId: ' + this.poolId + ' blueId: ' + this.blueId)
              this.apiInited = true;
          }
          else {
            console.log('No blue connect found for pool: ' + this.poolId);
          }

      }
      else{
          console.log('Blue Riiot API NOT inited. Not able to log in!');
      }

    } catch (error) {
        console.log('Blue Riiot API NOT inited. Error: ' + error);
    }

  }


  timerCallback() {
      this.refreshMeasurements()

      this.runningtimer = setTimeout(() => { this.timerCallback(); }, 10 * 60 * 1000);
  }

  startTimer() {
      console.log('Starting timer');
    //this.runningtimer = setTimeout(function() { this.timerCallback(); }.bind(this), 10000);
      this.runningtimer = setTimeout(() => { this.timerCallback(); }, 5000);
      console.log('Started timer');
  }

}

module.exports = BlueConnectDevice;

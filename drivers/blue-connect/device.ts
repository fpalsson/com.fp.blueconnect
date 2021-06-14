import { Device, FlowCardAction, FlowCardTriggerDevice, FlowToken } from 'homey';
// @ts-ignore
import { BlueriiotAPI } from 'blueriiot-api-client';
//import { mapSourcePosition } from 'source-map-support';
import { DateTime } from 'luxon';
//import { stringify } from 'querystring';

enum MeasurementStatus {
  WithinRecommended,
  AboveRecommended,
  BelowRecommended,
  LowWarning,
  HighWarning
}

type Measurement = {
  name:string,
  value:number,
  status:MeasurementStatus

};


class BlueConnectDevice extends Device {
  private api:any;
  private apiInited:boolean=false;
  private username:string='';
  private password:string='';
  private poolId:string='';
  private blueId:string='';
  private runningtimer!:NodeJS.Timeout;

  private lastMeasurementTimestamp:Date = new Date(0);
  private lastFeedTimestamp:Date = new Date(0);
  private lastPoolStatusTimestamp:Date = new Date(0);

  private capabilityCache:any=new Object();


  //Flow Cards
  private triggerTest!: FlowCardTriggerDevice;

  private triggerNewMeasurement!: FlowCardTriggerDevice;
  private triggerNewGuidanceAction!: FlowCardTriggerDevice;
  private triggerNeedsAttention!: FlowCardTriggerDevice;

  private actionRefreshMeasurement!: FlowCardAction;

  //private triggerPhChanged!: FlowCardTriggerDevice;  //Not needed as the SDK triggers the flow automatically as the name is xxx_changed
  private triggerPhGoesAbove!: FlowCardTriggerDevice;
  private triggerPhGoesBelow!: FlowCardTriggerDevice;

  //private triggerOrpChanged!: FlowCardTriggerDevice;  //Not needed as the SDK triggers the flow automatically as the name is xxx_changed
  private triggerOrpGoesAbove!: FlowCardTriggerDevice;
  private triggerOrpGoesBelow!: FlowCardTriggerDevice;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {

    //ugly way to make sure sensors are ordered the way we want. :-(
    if (false)
    {
      if (this.hasCapability('measure_temperature')) await this.removeCapability('measure_temperature');
      if (this.hasCapability('measure_ph')) await this.removeCapability('measure_ph');
      if (this.hasCapability('measure_orp')) await this.removeCapability('measure_orp');
      if (this.hasCapability('status_ph')) await this.removeCapability('status_ph');
      if (this.hasCapability('status_orp')) await this.removeCapability('status_orp');
      if (this.hasCapability('measurement_timestamp')) await this.removeCapability('measurement_timestamp');
      if (this.hasCapability('alarm_need_attention')) await this.removeCapability('alarm_need_attention');
      if (this.hasCapability('guidance_action')) await this.removeCapability('guidance_action');
      if (this.hasCapability('measure_conductivity')) await this.removeCapability('measure_conductivity');
      if (this.hasCapability('measure_salinity')) await this.removeCapability('measure_salinity');
      if (this.hasCapability('status_salinity')) await this.removeCapability('status_salinity');
    }

    if (!this.hasCapability('measure_temperature')) await this.addCapability('measure_temperature');
    if (!this.hasCapability('measure_ph')) await this.addCapability('measure_ph');
    if (!this.hasCapability('measure_orp')) await this.addCapability('measure_orp');
    if (!this.hasCapability('measure_conductivity')) await this.addCapability('measure_conductivity'); //Will be removed later if saliity is used
    if (!this.hasCapability('measure_salinity')) await this.addCapability('measure_salinity'); //Will be removed later if conductivity is used
    if (!this.hasCapability('status_ph')) await this.addCapability('status_ph');
    if (!this.hasCapability('status_orp')) await this.addCapability('status_orp');
    if (!this.hasCapability('status_salinity')) await this.addCapability('status_salinity'); //Will be removed later if conductivity is used
    if (!this.hasCapability('measurement_timestamp')) await this.addCapability('measurement_timestamp');
    if (!this.hasCapability('alarm_need_attention')) await this.addCapability('alarm_need_attention');
    if (!this.hasCapability('guidance_action')) await this.addCapability('guidance_action');

    //this.setCapabilityValue2('alarm_need_attention', false);

    //await this.setCapabilityValue2('measure_orp', 500);
/*
    this.triggerTest = this.homey.flow.getDeviceTriggerCard('test');
    this.triggerTest.registerRunListener(async (args:any, state:any) => {
      console.log('triggerTest run');
      return false;
    })
  */   
    this.triggerNewMeasurement = this.homey.flow.getDeviceTriggerCard('new_measurement');
    this.triggerNewGuidanceAction = this.homey.flow.getDeviceTriggerCard('new_guidance_action');
    this.triggerNeedsAttention = this.homey.flow.getDeviceTriggerCard('pool_need_attention');

    //this.triggerPhChanged = this.homey.flow.getDeviceTriggerCard('measure_ph_changed');
    //Changed trigger will be handeled by homey as it has id XXX_changed
    
    this.triggerPhGoesAbove = this.homey.flow.getDeviceTriggerCard('measure_ph_goes_above');
    this.triggerPhGoesBelow = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_below');

    //this.triggerOrpChanged = this.homey.flow.getDeviceTriggerCard('measure_orp_changed');
    //Changed trigger will be handeled by homey as it has id XXX_changed
    
    this.triggerOrpGoesAbove = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_above');
    this.triggerOrpGoesBelow = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_below');
    
    let data:any = this.getData();
    console.log(data.id);

    this.poolId = data.id;

    this.username = await this.getSetting('username');
    this.password = await this.getSetting('password');

    await this.initAPI();
    if (this.apiInited) {
        this.startTimer();
    }
    this.startTestTimer();
    
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

  async setCapabilityValue2(capabilityId:string, value:any){
    this.capabilityCache[capabilityId]=value;
    this.setCapabilityValue(capabilityId, value);
  }

  getCapabilityValue2(capabilityId:string){
    let res = this.capabilityCache[capabilityId];
    if (res == undefined) {
      res = this.getCapabilityValue(capabilityId);
      this.capabilityCache[capabilityId]=res;
    }
    return res;
  }

  utcToLocalTimeString(utcDate:Date):string{
    let options = { year: 'numeric', month: 'numeric', day: 'numeric' , hour: 'numeric', minute: 'numeric', hour12:  false } as const;
    //const { DateTime } = require('luxon');
    
    const utc = DateTime.fromJSDate(utcDate);
    const luxonDateLocal = utc.setZone(this.homey.clock.getTimezone());
//          const dateLocal = new Date(luxonDateLocal.toJSDate()));

    console.log('Measurement timestamp (local time): ' + luxonDateLocal.toString());

    return luxonDateLocal.toLocaleString( {month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });

  }

  async refreshFeed() {
    try {
      //console.log('Starting refresh with poolId: ' + this.poolId + ' blueId: ' + this.blueId);
      let feedStringData = await this.api.getSwimmingPoolFeed(this.poolId, "en");
      let feedData = JSON.parse(feedStringData);
  
      console.log('Read feed...');
      console.log(feedStringData);

      let feedTimestamp = new Date(Date.parse(feedData.timestamp));
      if (feedTimestamp > this.lastFeedTimestamp) {
          this.lastFeedTimestamp = feedTimestamp;
          feedData.data.forEach(async (feed:any) => {
            console.log('feed.data[x].id: ' + feed.id);
            console.log('feed.data[x].title: ' + feed.title);
            console.log('feed.data[x].message: ' + feed.message);
          });
   
      }
      else {
          console.log('No new feed...');
      }

        
    } catch (error) {
      console.log('Error in refreshFeed: ' + error);      
    }
  }

  async refreshPoolStatus() {
    try {
      //console.log('Starting refresh with poolId: ' + this.poolId + ' blueId: ' + this.blueId);
      let poolStatusStringData = await this.api.getSwimmingPoolStatus(this.poolId);
      let poolStatus = JSON.parse(poolStatusStringData);
  
      console.log('Read pool status...');
      console.log(poolStatusStringData);

      let lastValue = this.getCapabilityValue2('alarm_need_attention');
      if (lastValue == undefined) lastValue = false;

      let status = poolStatus.global_status_code;
      if (status == 'SP_NOT_OK'){
        if (lastValue == false){
          console.log('Pool status not ok. Setting alarm');
          await this.setCapabilityValue2('alarm_need_attention', true);
          let trigger:any = this.triggerNeedsAttention; // as the type definitions are wrong...
          trigger.trigger(this,{},{});
        }
      }
      else if (status == 'SP_OK') {
        if (lastValue == true){
          console.log('Pool status not ok. Clearing alarm');
          await this.setCapabilityValue2('alarm_need_attention', false);
        } 
      }
      else{
        console.log('Pool status not understood. Dooing nothing');

      }

      let poolStatusTimestamp = new Date(Date.parse(poolStatus.created));
      if (poolStatusTimestamp > this.lastPoolStatusTimestamp) {
          this.lastPoolStatusTimestamp = poolStatusTimestamp;
          poolStatus.tasks.forEach(async (task:any) => {
            console.log('status.task: ' + JSON.stringify(task));
          });
   
      }
      else {
          console.log('No new pool status...');
      }

        
    } catch (error) {
      console.log('Error in refreshPoolStatus: ' + error);      
    }
  }
  async refreshPoolGuidance() {
    try {
      //console.log('Starting refresh with poolId: ' + this.poolId + ' blueId: ' + this.blueId);
      let poolGuidanceStringData = await this.api.getGuidance(this.poolId, "en");
      let poolGuidance = JSON.parse(poolGuidanceStringData);
  
      console.log('Read pool guidance...');
      console.log(poolGuidanceStringData);

      //let poolGuidanceTimestamp = new Date(Date.parse(poolGuidance.created));
      //"swp_global_status": "SP_NOT_OK",
      let id = '';
      let action = '';
      let title = '';

      if (poolGuidance.guidance.swp_global_status == 'SP_NOT_OK'){
        console.log('Guidance status: SP_NOT_OK');
        id = poolGuidance.guidance.issue_to_fix.task_identifier;
        action = poolGuidance.guidance.issue_to_fix.action_title;
        title = poolGuidance.guidance.issue_to_fix.issue_title;
      }
      else if (poolGuidance.guidance.swp_global_status == 'SP_OK') {
        console.log('Guidance status: SP_OK');
        action = 'Nothing to do';
      }
      else {
        console.log('Guidance status: ' + poolGuidance.guidance.swp_global_status);
        action = 'Unknown action info retreived!';
      }
    
      if (action != this.getCapabilityValue2('guidance_action')){

        await this.setCapabilityValue2('guidance_action', action);  
        console.log('New guidance: ' + action);

        const tokens = 
        {
          guidance_action : <string>action,
        }
        
        let trigger:any = this.triggerNewGuidanceAction;
        await trigger.trigger(this, tokens, {});
        console.log('Triggered new guidance action flow');
      }
    } catch (error) {
      console.log('Error in refreshPoolGuidance: ' + error);      
    }
  }

  async refreshMeasurements() {
    try {
      //console.log('Starting refresh with poolId: ' + this.poolId + ' blueId: ' + this.blueId);
      let measurementsStringData = await this.api.getLastMeasurements(this.poolId, this.blueId)
      let measurementsData = JSON.parse(measurementsStringData);
  
      console.log('Read measurement...');
      console.log(measurementsStringData);

      let measurementTimestamp = new Date(Date.parse(measurementsData.last_blue_measure_timestamp));
      if (measurementTimestamp > this.lastMeasurementTimestamp) {
          this.lastMeasurementTimestamp = measurementTimestamp

          await this.setCapabilityValue2('measurement_timestamp', this.utcToLocalTimeString(measurementTimestamp));  

          measurementsData.data.forEach(async (measurement:any) => {
  
              let pm = this.parseMeasurement(measurement);
              
              if (pm.name == 'ph' || pm.name == 'temperature' || pm.name == 'salinity') pm.value = Math.round(pm.value*10)/10; 
              else pm.value=Math.round(pm.value);

              switch(pm.name) { 
                  case 'temperature': { 
                      await this.setCapabilityValue2('measure_temperature', pm.value);
                      console.log('New temperature measurement. Now: ' + pm.value);
                      //}
                  break; 
                  } 
                  case 'ph': { 
                    let lastValue:number = this.getCapabilityValue2('measure_ph');
                    await this.setCapabilityValue2('measure_ph', pm.value);
                    await this.setCapabilityValue2('status_ph', this.createStatusText(pm.status));      
                    this.runNumberTriggers(lastValue, pm.value, {measure_ph: pm.value}, null, this.triggerPhGoesAbove, this.triggerPhGoesBelow); //change trigger will be triggered automatically by homey, as the name is xxx_changed
                    console.log('New pH measurement. Now: ' + pm.value);
                  break; 
                  } 
                  case 'orp': { 
                    let lastValue:number = this.getCapabilityValue2('measure_orp');
                    await this.setCapabilityValue2('measure_orp', pm.value);      
                    await this.setCapabilityValue2('status_orp', this.createStatusText(pm.status));      
                    this.runNumberTriggers(lastValue, pm.value, {measure_orp: pm.value}, null, this.triggerOrpGoesAbove, this.triggerOrpGoesBelow); //change trigger will be triggered automatically by homey, as the name is xxx_changed
                    console.log('New ORP measurement. Now: ' + pm.value);
                  break; 
                  } 
                  case 'conductivity': { 
                    if (this.hasCapability('measure_salinity')) await this.removeCapability('measure_salinity')
                    if (this.hasCapability('status_salinity')) await this.removeCapability('status_salinity')

//                    if (!this.hasCapability('measure_conductivity')) await this.addCapability('measure_conductivity')
                    await this.setCapabilityValue2('measure_conductivity', pm.value);      
                    console.log('New conductivity measurement. Now: ' + pm.value);
                  break; 
                  } 
                  case 'salinity': { 
                    if (this.hasCapability('measure_conductivity')) await this.removeCapability('measure_conductivity')

//                    if (!this.hasCapability('measure_salinity')) await this.addCapability('measure_salinity')
                    await this.setCapabilityValue2('measure_salinity', pm.value);      
//                    if (!this.hasCapability('status_salinity')) await this.addCapability('status_salinity')
                    await this.setCapabilityValue2('status_salinity', this.createStatusText(pm.status));      
                    console.log('New salinity measurement. Now: ' + pm.value);
                  break; 
                  } 
                  default: { 
                        //statements; 
                        break; 
                  } 
              } 
          });
     
          /*let phFlowToken:FlowToken = new FlowToken();
          phFlowToken.id='ph';
          phFlowToken.setValue(this.getCapabilityValue2('measure_ph'));
*/
          const tokens = 
          {
            measure_ph : <number>this.getCapabilityValue2('measure_ph'),
            measure_orp : <number>this.getCapabilityValue2('measure_orp'),
            measure_temperature : <number>this.getCapabilityValue2('measure_temperature'),
            measure_conductivity : this.hasCapability('measure_conductivity') ? <number>this.getCapabilityValue2('measure_conductivity') : 0,
            measure_salinity : this.hasCapability('measure_salinity') ? <number>this.getCapabilityValue2('measure_salinity') : 0,
            measurement_timestamp : <string>this.getCapabilityValue2('measurement_timestamp'),
          }
          console.log ('Tokens new measurement: ' + tokens);

          let trigger:any = this.triggerNewMeasurement;
          await trigger.trigger(this, tokens, {});
          console.log('Triggered new measurement flow');
      }
      else {
          console.log('No new measurement...');
      }

        
    } catch (error) {
      console.log('Error in refreshMeasurements: ' + error);      
    }
    
  }

  runNumberTriggers(prevValue:number, newValue:number, tokens:object,
    changeTrigger:any, 
    goesAboveTrigger:any, 
    goesBelowTrigger:any){

      console.log('runNumberTriggers start');
      if (changeTrigger!=null) changeTrigger.trigger(this, tokens, { prevVal:prevValue, newVal:newValue });
      if (goesAboveTrigger!=null) goesAboveTrigger.trigger(this, tokens, { prevVal:prevValue, newVal:newValue });
      if (goesBelowTrigger!=null) goesBelowTrigger.trigger(this, tokens, { prevVal:prevValue, newVal:newValue });
      console.log('runNumberTriggers done');
  }


  createStatusText(status:MeasurementStatus):string {
    let res='';
    if (status == MeasurementStatus.WithinRecommended) res = 'Ok';
    else if (status == MeasurementStatus.AboveRecommended) res = 'Above recommended';
    else if (status == MeasurementStatus.BelowRecommended) res = 'Below recommended';
    else if (status == MeasurementStatus.LowWarning) res = 'Low warning!';
    else if (status == MeasurementStatus.HighWarning) res = 'Hign warning!';
    return res;
  }



  parseMeasurement(measurement:any):Measurement {
    let val = measurement.value;
  
    let measurementStatus: MeasurementStatus;
    if (val < measurement.warning_low)       { measurementStatus = MeasurementStatus.LowWarning }
    else if (val < measurement.ok_min)       { measurementStatus = MeasurementStatus.BelowRecommended }
    else if (val < measurement.ok_max)       { measurementStatus = MeasurementStatus.WithinRecommended }
    else if (val < measurement.warning_high) { measurementStatus = MeasurementStatus.AboveRecommended }
    else                                     { measurementStatus = MeasurementStatus.HighWarning }
    
    
    let res:Measurement = { 
      name: measurement.name,
      value: val,
      status: measurementStatus
    } 
    return res;
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
      this.refreshMeasurements();
      this.refreshFeed();
      this.refreshPoolGuidance();
      this.refreshPoolStatus();

      this.runningtimer = setTimeout(() => { this.timerCallback(); }, 10 * 60 * 1000);
  }

  startTimer() {
      console.log('Starting timer');
    //this.runningtimer = setTimeout(function() { this.timerCallback(); }.bind(this), 10000);
      this.runningtimer = setTimeout(() => { this.timerCallback(); }, 5000);
      console.log('Started timer');
  }

  startTestTimer() {
    console.log('Starting timer');
  //this.runningtimer = setTimeout(function() { this.timerCallback(); }.bind(this), 10000);
    this.runningtimer = setTimeout(() => { this.timerTestCallback(); }, 10000);
    console.log('Started timer');
  }

  timerTestCallback() {
    /*
    console.log('Test trigger');
    let tt:any;
    tt= this.triggerTest;

    tt.trigger(this, {val:5}, {olle:5});
    console.log('Test trigger done');

    //this.triggerTest.trigger({val:5}, {olle:5});
*/
    this.runningtimer = setTimeout(() => { this.timerTestCallback(); }, 10000);
}

}

module.exports = BlueConnectDevice;

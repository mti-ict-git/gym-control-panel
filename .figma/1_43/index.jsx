import React from 'react';

import styles from './index.module.scss';

const Component = () => {
  return (
    <div className={styles.emptyState}>
      <img src="../image/mjti5c01-aihx9l5.svg" className={styles.quickNotes} />
      <div className={styles.group1000001865}>
        <div className={styles.group1000001864}>
          <div className={styles.group1000001852}>
            <img src="../image/mjti5c01-kjgp7i9.svg" className={styles.a4} />
            <img src="../image/mjti5c01-l8chfpj.svg" className={styles.a0} />
            <img src="../image/mjti5c01-cjc8p3v.svg" className={styles.a4} />
          </div>
          <img
            src="../image/mjti5c01-p757wvd.png"
            className={styles.group1000001859}
          />
        </div>
        <div className={styles.frame1000001841}>
          <div className={styles.frame1000001855}>
            <p className={styles.pageNotFound}>Page Not Found</p>
            <div className={styles.heading5}>
              <p className={styles.sorryThePageYouReLoo}>
                Sorry, the page you’re looking for does not exist or has been moved{" "}
                <br />
                please go back to the Home page
              </p>
            </div>
          </div>
          <div className={styles.button}>
            <p className={styles.goBackHome}>Go back Home</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Component;

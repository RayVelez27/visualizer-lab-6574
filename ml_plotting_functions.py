# Data importing
import numpy as np  # Fundamental library for numerical computations
import pickle  # For loading serialized Python objects (pickles)
from sklearn.metrics import auc  # For calculating Area Under the Curve
from sklearn.metrics import RocCurveDisplay  # To plot individual ROC curves
from scipy.signal import savgol_filter  # For smoothing curves
import matplotlib.pyplot as plt  # Primary plotting library

### Functions for Plotting data
def plot_ROC_AUC(pickle, type='mean', plot_title=None) :
    # Plots individual and mean or median AUC plots from a single pickle
    # Uses mean or median to calculate AUC from each seed in pickle
    # from: https://scikit-learn.org/stable/auto_examples/model_selection/plot_roc_crossval.html
    tprs = []
    aucs = []
    mean_fpr = np.linspace(0, 1, 100)
    fig, ax = plt.subplots()
    # Extracting results per replicate
    for i in pickle.keys():  
        pickle_rep=pickle[i]

        # Get each ROC curve
        viz = RocCurveDisplay.from_estimator(
            pickle_rep['Fit_model'],
            pickle_rep['X_testset'],
            pickle_rep['y_testset'],
            name="ROC fold {}".format(i),  # Label for the ROC curve of this fold
            alpha=0.3,  # Transparency of the ROC curve
            lw=1,  # Line width of the ROC curve
            ax=ax  # Axis to plot the ROC curve on
        )

        # Interpolate (deduce) the true positive rates (TPR) at the mean false positive rate (FPR)
        interp_tpr = np.interp(mean_fpr, viz.fpr, viz.tpr)
        interp_tpr[0] = 0.0
        
        # Append the interpolated TPR values and AUC (Area Under Curve) for this fold
        tprs.append(interp_tpr)
        aucs.append(viz.roc_auc)
    if type=="mean":
        mean_tpr = np.mean(tprs, axis=0)
    elif type=="median":
        mean_tpr = np.median(tprs, axis=0)
    else:
        print("incorrect type specified, options are 'mean' and 'median'")
        
    mean_tpr[-1] = 1.0
    smoothed_mean_tpr=savgol_filter(mean_tpr, window_length=11, polyorder=2)
    mean_auc = auc(mean_fpr, mean_tpr)
    std_auc = np.std(aucs)
    ax.plot(
        mean_fpr,
        smoothed_mean_tpr,
        color="b",
        label=f"{type} ROC (AUC = %0.2f $\pm$ %0.2f)" % (mean_auc, std_auc),
        lw=2,
        alpha=0.8,
    )

    std_tpr = np.std(tprs, axis=0)
    smoothed_std_tpr=savgol_filter(std_tpr, window_length=11, polyorder=2)
    tprs_upper = np.minimum(smoothed_mean_tpr + smoothed_std_tpr, 1)
    tprs_lower = np.maximum(smoothed_mean_tpr - smoothed_std_tpr, 0)
    ax.fill_between(
        mean_fpr,
        tprs_lower,
        tprs_upper,
        color="grey",
        alpha=0.2,
        label=r"$\pm$ 1 std. dev.",
    )

    ax.set(
        xlim=[-0.05, 1.05],
        ylim=[-0.05, 1.05],
        title=plot_title,
    )
    ax.legend(loc="lower right")
    plt.show()

def compare_plot_ROC_AUC(pickles, plot_names, colorset=['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#F0E442'], type='mean',
                         plot_title=None):
    # Plots the mean or median AUC plots from multiple ML runs together
    # Requires a list of pickles, and a list of labels for the plot.
    # Colorset is customizable as 'colorset'
    # Uses mean or median to calculate AUC from each seed in pickle
    # adapted from: https://scikit-learn.org/stable/auto_examples/model_selection/plot_roc_crossval.html
    n=0
    fig, ax = plt.subplots()
    # Extracting results per replicate
    for pickle in pickles:
        tprs = []
        aucs = []
        for i in pickle.keys():  
            pickle_rep=pickle[i]
            mean_fpr = np.linspace(0, 1, 100)
            # Get each ROC curve
            viz = RocCurveDisplay.from_estimator(
                pickle_rep['Fit_model'],
                pickle_rep['X_testset'],
                pickle_rep['y_testset'],
                label=None,
                alpha=0,  # Transparency of the ROC curve
                lw=0,  # Line width of the ROC curve
                ax=ax  # Axis to plot the ROC curve on
            )

            # Interpolate (deduce) the true positive rates (TPR) at the mean false positive rate (FPR)
            interp_tpr = np.interp(mean_fpr, viz.fpr, viz.tpr)
            interp_tpr[0] = 0.0
            
            # Append the interpolated TPR values and AUC (Area Under Curve) for this fold
            tprs.append(interp_tpr)
            aucs.append(viz.roc_auc)
        if type=="mean":
            mean_tpr = np.mean(tprs, axis=0)
        elif type=="median":
            mean_tpr = np.median(tprs, axis=0)
        else:
            print("incorrect type specified, options are 'mean' and 'median'")
            
        mean_tpr[-1] = 1.0
        smoothed_mean_tpr=savgol_filter(mean_tpr, window_length=11, polyorder=2)
        mean_auc = auc(mean_fpr, mean_tpr)
        std_auc = np.std(aucs)
        ax.plot(
            mean_fpr,
            smoothed_mean_tpr,
            color=colorset[n],
            label=f"{plot_names[n]} (AUC = %0.2f $\pm$ %0.2f)" % (mean_auc, std_auc),
            lw=2,
            alpha=0.8,
        )

        std_tpr = np.std(tprs, axis=0)
        smoothed_std_tpr=savgol_filter(std_tpr, window_length=11, polyorder=2)
        tprs_upper = np.minimum(smoothed_mean_tpr + smoothed_std_tpr, 1)
        tprs_lower = np.maximum(smoothed_mean_tpr - smoothed_std_tpr, 0)
        ax.fill_between(
            mean_fpr,
            tprs_lower,
            tprs_upper,
            color=colorset[n],
            alpha=0.1,
            #label=r"$\pm$ 1 std. dev.",
        )

        ax.set(
            xlim=[-0.05, 1.05],
            ylim=[-0.05, 1.05],
            title=plot_title,
        )
        ax.legend(loc="lower right")
        n=n+1
    return fig
